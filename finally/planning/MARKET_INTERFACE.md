# Market Data Interface

Unified Python interface for stock price data in FinAlly. Two concrete implementations — a GBM simulator and a Massive API client — sit behind one abstract interface. All downstream code (SSE streaming, trade execution, portfolio valuation) is source-agnostic.

---

## Architecture

```
create_market_data_source(price_cache)
        │
        ├── MASSIVE_API_KEY set → MassiveDataSource  (polls Massive REST API)
        └── not set             → SimulatorDataSource (GBM simulator)
                │
                ▼ writes to
           PriceCache  (thread-safe, in-memory)
                │
                ├──→ SSE stream  (/api/stream/prices)
                ├──→ Trade execution (current price lookup)
                └──→ Portfolio valuation (position × price)
```

The data source runs as a background asyncio task. It writes to the `PriceCache` on its own schedule (500ms for the simulator, 15s for Massive free tier). Consumers only ever read from the cache — they never call the data source directly.

---

## Core Data Model

```python
# backend/app/market/models.py

from dataclasses import dataclass, field
import time

@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at one point in time."""
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat'."""
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for JSON / SSE transmission."""
        return {
            "ticker": self.ticker,
            "price": self.price,
            "previous_price": self.previous_price,
            "timestamp": self.timestamp,
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

`PriceUpdate` is the only data structure that crosses the market data boundary. The SSE endpoint, trade execution, and portfolio routes all work with `PriceUpdate` objects or their serialized form.

---

## Abstract Interface

```python
# backend/app/market/interface.py

from abc import ABC, abstractmethod

class MarketDataSource(ABC):
    """Contract for all price data providers.

    Lifecycle:
        source = create_market_data_source(cache)
        await source.start(["AAPL", "GOOGL", ...])
        await source.add_ticker("TSLA")
        await source.remove_ticker("GOOGL")
        await source.stop()
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Begin producing price updates. Starts a background task.
        Call exactly once. Seeding the cache with initial prices is the
        implementation's responsibility — consumers expect data immediately."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background task. Safe to call multiple times."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. No-op if already present.
        Takes effect on the next update cycle."""

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker. Also removes it from the PriceCache."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return the current list of actively tracked tickers."""
```

---

## Price Cache

The `PriceCache` is the shared state between producer (data source) and consumers (SSE, API routes). It is thread-safe because the asyncio event loop runs on one thread but the `RESTClient` calls run on a thread pool via `asyncio.to_thread`.

```python
# backend/app/market/cache.py

from threading import Lock
import time
from .models import PriceUpdate

class PriceCache:
    """Thread-safe, in-memory store of the latest price per ticker."""

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0  # bumped on every write; SSE uses this for change detection

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. Returns the PriceUpdate created.
        First update for a ticker: previous_price == price, direction == 'flat'."""
        with self._lock:
            ts = timestamp or time.time()
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price
            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot of all prices. Returns a shallow copy."""
        with self._lock:
            return dict(self._prices)

    def get_price(self, ticker: str) -> float | None:
        update = self.get(ticker)
        return update.price if update else None

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        """Monotonically increasing. Incremented on every update call."""
        return self._version
```

The `version` counter lets the SSE endpoint skip a JSON serialization pass when nothing has changed — it compares `current_version != last_sent_version` before building the payload.

---

## Factory

```python
# backend/app/market/factory.py

import logging
import os
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Return the right data source based on environment.

    MASSIVE_API_KEY set and non-empty → MassiveDataSource
    Otherwise                         → SimulatorDataSource
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        from .massive_client import MassiveDataSource
        logger.info("Market data: Massive API")
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        from .simulator import SimulatorDataSource
        logger.info("Market data: GBM simulator")
        return SimulatorDataSource(price_cache=price_cache)
```

---

## Concrete Implementations

### MassiveDataSource

Polls `GET /v2/snapshot/locale/us/markets/stocks/tickers` for all watched tickers in a single call. See `MASSIVE_API.md` for the full API reference.

```python
# backend/app/market/massive_client.py

import asyncio
import logging
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

class MassiveDataSource(MarketDataSource):
    """Polls the Massive REST API for real market data.

    The RESTClient is synchronous; calls run in a thread pool via
    asyncio.to_thread to avoid blocking the event loop.

    Free tier: poll every 15s (5 req/min limit, one call per poll).
    Paid tier: poll every 2–5s.
    """

    def __init__(self, api_key: str, price_cache: PriceCache, poll_interval: float = 15.0):
        self._client = RESTClient(api_key=api_key)
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = list(tickers)
        await self._poll_once()  # Seed cache immediately
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")
        logger.info("Massive poller started: %d tickers, %.1fs interval", len(tickers), self._interval)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        if not self._tickers:
            return
        try:
            snapshots = await asyncio.to_thread(
                self._client.get_snapshot_all,
                market_type=SnapshotMarketType.STOCKS,
                tickers=self._tickers,
            )
            for snap in snapshots:
                try:
                    self._cache.update(
                        ticker=snap.ticker,
                        price=snap.last_trade.price,
                        timestamp=snap.last_trade.timestamp / 1000.0,
                    )
                except (AttributeError, TypeError) as e:
                    logger.warning("Skipping snapshot for %s: %s", getattr(snap, "ticker", "?"), e)
        except Exception as e:
            logger.error("Massive poll failed: %s", e)
            # Don't re-raise — next interval will retry
```

### SimulatorDataSource

Wraps `GBMSimulator` in an async loop. See `MARKET_SIMULATOR.md` for the GBM math and correlation model.

```python
# backend/app/market/simulator.py (SimulatorDataSource portion)

import asyncio
import logging
from .cache import PriceCache
from .interface import MarketDataSource
from .gbm import GBMSimulator  # See MARKET_SIMULATOR.md

logger = logging.getLogger(__name__)

class SimulatorDataSource(MarketDataSource):
    """Wraps GBMSimulator in an async loop, writing to PriceCache every 500ms."""

    def __init__(self, price_cache: PriceCache, update_interval: float = 0.5):
        self._cache = price_cache
        self._interval = update_interval
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers)
        # Seed cache with initial prices immediately
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")
        logger.info("Simulator started with %d tickers", len(tickers))

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def add_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.add_ticker(ticker)
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)

    async def remove_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return self._sim.get_tickers() if self._sim else []

    async def _run_loop(self) -> None:
        while True:
            try:
                if self._sim:
                    prices = self._sim.step()
                    for ticker, price in prices.items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)
```

---

## SSE Streaming Endpoint

Reads from `PriceCache` every 500ms and pushes to all connected clients.

```python
# backend/app/market/stream.py

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from .cache import PriceCache

logger = logging.getLogger(__name__)

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api/stream", tags=["streaming"])

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(
            _generate_events(price_cache, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return router

async def _generate_events(
    price_cache: PriceCache,
    request: Request,
    interval: float = 0.5,
) -> AsyncGenerator[str, None]:
    yield "retry: 1000\n\n"  # Tell browser to reconnect after 1s on disconnect
    last_version = -1

    while True:
        if await request.is_disconnected():
            break
        current_version = price_cache.version
        if current_version != last_version:
            last_version = current_version
            prices = price_cache.get_all()
            if prices:
                data = {ticker: update.to_dict() for ticker, update in prices.items()}
                yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(interval)
```

**SSE event shape** (the `data:` payload):

```json
{
  "AAPL": {
    "ticker": "AAPL",
    "price": 191.25,
    "previous_price": 191.10,
    "timestamp": 1718200000.0,
    "change": 0.15,
    "change_percent": 0.0785,
    "direction": "up"
  },
  "GOOGL": { "...": "..." }
}
```

The frontend receives this as a single JSON object containing all tracked tickers. It connects via `new EventSource("/api/stream/prices")` with no auth — same origin.

---

## Application Lifecycle

```python
# backend/app/main.py (abbreviated)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market import PriceCache, create_market_data_source, create_stream_router
from .db import get_initial_tickers  # reads watchlist from SQLite

price_cache = PriceCache()
market_source = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global market_source
    tickers = get_initial_tickers()           # e.g. ["AAPL", "GOOGL", ...]
    market_source = create_market_data_source(price_cache)
    await market_source.start(tickers)
    yield
    await market_source.stop()

app = FastAPI(lifespan=lifespan)
app.include_router(create_stream_router(price_cache))
```

**Watchlist changes** (e.g., from `POST /api/watchlist`):

```python
await market_source.add_ticker("PYPL")    # starts generating prices immediately
await market_source.remove_ticker("NFLX") # removes from cache and stops tracking
```

---

## File Structure

```
backend/app/market/
  __init__.py          # Public API: PriceUpdate, PriceCache, MarketDataSource,
                       #             create_market_data_source, create_stream_router
  models.py            # PriceUpdate dataclass
  interface.py         # MarketDataSource ABC
  cache.py             # PriceCache
  factory.py           # create_market_data_source()
  massive_client.py    # MassiveDataSource
  simulator.py         # GBMSimulator + SimulatorDataSource
  seed_prices.py       # SEED_PRICES, TICKER_PARAMS constants
  stream.py            # SSE endpoint factory
```

---

## Design Decisions

| Decision | Reason |
|----------|--------|
| Push to cache, don't pull | Decouples producer schedule from consumer reads; N SSE clients all read from one cache |
| `PriceCache` as single truth | One write path, many read paths; avoids race conditions between data source and SSE |
| `asyncio.to_thread` for REST calls | Massive's `RESTClient` is synchronous; running it in a thread avoids blocking the FastAPI event loop |
| `version` counter on cache | Cheap O(1) check to skip serialization when no new data has arrived since last SSE tick |
| Factory function, not DI framework | Simple, obvious, no extra dependencies |
