# Market Data Interface

This document defines the unified Python abstraction that decouples all downstream code (SSE streaming, price cache, tests) from the data source. The backend selects the implementation at startup based on the `MASSIVE_API_KEY` environment variable.

---

## Design Goals

- One interface, two implementations: `MassiveMarketData` and `SimulatorMarketData`.
- All downstream code (SSE, portfolio snapshots, tests) talks to the interface only.
- The interface is async-native — implementations run as background `asyncio` tasks.
- A shared in-memory `PriceCache` decouples the producer (poller/simulator) from consumers (SSE clients).

---

## Data Model

```python
# backend/market/models.py
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class PriceUpdate:
    ticker: str
    price: float
    prev_price: float
    change: float           # price - prev_price
    change_pct: float       # (change / prev_price) * 100
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat'"""
        if self.change > 0:
            return "up"
        if self.change < 0:
            return "down"
        return "flat"
```

---

## Abstract Interface

```python
# backend/market/base.py
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

class MarketDataProvider(ABC):
    """
    Async market data provider. Implementations poll or simulate prices
    and write updates to the shared PriceCache.
    """

    @abstractmethod
    async def start(self) -> None:
        """Start the background polling/simulation loop."""

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully stop the background loop."""

    @abstractmethod
    async def get_price(self, ticker: str) -> PriceUpdate | None:
        """Return the latest cached price for a single ticker, or None."""

    @abstractmethod
    async def get_prices(self, tickers: list[str]) -> dict[str, PriceUpdate]:
        """Return latest cached prices for multiple tickers."""
```

---

## Shared Price Cache

The cache sits between the provider (writer) and SSE consumers (readers). It is the single source of truth for current prices in the running process.

```python
# backend/market/cache.py
import asyncio
from datetime import datetime
from .models import PriceUpdate

class PriceCache:
    """Thread-safe in-memory price store."""

    def __init__(self) -> None:
        self._data: dict[str, PriceUpdate] = {}
        self._lock = asyncio.Lock()

    async def update(self, update: PriceUpdate) -> None:
        async with self._lock:
            self._data[update.ticker] = update

    async def update_many(self, updates: list[PriceUpdate]) -> None:
        async with self._lock:
            for u in updates:
                self._data[u.ticker] = u

    async def get(self, ticker: str) -> PriceUpdate | None:
        async with self._lock:
            return self._data.get(ticker)

    async def get_all(self) -> dict[str, PriceUpdate]:
        async with self._lock:
            return dict(self._data)

    async def tickers(self) -> list[str]:
        async with self._lock:
            return list(self._data.keys())
```

---

## Massive API Implementation

```python
# backend/market/massive.py
import asyncio
import logging
import httpx
from datetime import datetime
from .base import MarketDataProvider
from .cache import PriceCache
from .models import PriceUpdate

logger = logging.getLogger(__name__)

MASSIVE_BASE_URL = "https://api.massive.com"
SNAPSHOT_PATH = "/v2/snapshot/locale/us/markets/stocks/tickers"


class MassiveMarketData(MarketDataProvider):
    """
    Polls the Massive REST snapshot endpoint for all watched tickers.
    Uses one API call per cycle to stay within rate limits.
    """

    def __init__(
        self,
        api_key: str,
        cache: PriceCache,
        tickers: list[str],
        poll_interval: float = 15.0,  # seconds; 15s = 4 calls/min on free tier
    ) -> None:
        self._api_key = api_key
        self._cache = cache
        self._tickers = list(tickers)
        self._poll_interval = poll_interval
        self._task: asyncio.Task | None = None

    def add_ticker(self, ticker: str) -> None:
        if ticker not in self._tickers:
            self._tickers.append(ticker)

    def remove_ticker(self, ticker: str) -> None:
        self._tickers = [t for t in self._tickers if t != ticker]

    async def start(self) -> None:
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("MassiveMarketData started, poll_interval=%.1fs", self._poll_interval)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def get_price(self, ticker: str) -> PriceUpdate | None:
        return await self._cache.get(ticker)

    async def get_prices(self, tickers: list[str]) -> dict[str, PriceUpdate]:
        all_prices = await self._cache.get_all()
        return {t: all_prices[t] for t in tickers if t in all_prices}

    async def _poll_loop(self) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                try:
                    await self._fetch_and_update(client)
                except Exception:
                    logger.exception("Massive snapshot poll failed")
                await asyncio.sleep(self._poll_interval)

    async def _fetch_and_update(self, client: httpx.AsyncClient) -> None:
        if not self._tickers:
            return

        params = {
            "tickers": ",".join(self._tickers),
            "apiKey": self._api_key,
        }
        resp = await client.get(
            f"{MASSIVE_BASE_URL}{SNAPSHOT_PATH}",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") == "ERROR":
            raise ValueError(f"Massive API error: {data.get('message')}")

        updates = []
        for snap in data.get("tickers", []):
            ticker = snap.get("ticker")
            last_trade = snap.get("lastTrade") or {}
            day = snap.get("day") or {}
            prev_day = snap.get("prevDay") or {}

            price = last_trade.get("p") or day.get("c")
            if price is None:
                continue

            prev_close = prev_day.get("c") or price
            change = snap.get("todaysChange", price - prev_close)
            change_pct = snap.get("todaysChangePerc", 0.0)

            updates.append(PriceUpdate(
                ticker=ticker,
                price=price,
                prev_price=prev_close,
                change=change,
                change_pct=change_pct,
                timestamp=datetime.utcnow(),
            ))

        await self._cache.update_many(updates)
        logger.debug("Updated %d tickers from Massive", len(updates))
```

---

## Simulator Implementation

```python
# backend/market/simulator.py
# See MARKET_SIMULATOR.md for full design.
# Summary of interface compliance:

class SimulatorMarketData(MarketDataProvider):
    def __init__(self, cache: PriceCache, tickers: list[str], tick_interval: float = 0.5) -> None: ...
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def get_price(self, ticker: str) -> PriceUpdate | None: ...
    async def get_prices(self, tickers: list[str]) -> dict[str, PriceUpdate]: ...
    def add_ticker(self, ticker: str) -> None: ...
    def remove_ticker(self, ticker: str) -> None: ...
```

---

## Factory Function

The factory reads environment variables and returns the correct implementation. Call this once at application startup.

```python
# backend/market/factory.py
import os
from .cache import PriceCache
from .base import MarketDataProvider

DEFAULT_TICKERS = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
    "NVDA", "META", "JPM", "V", "NFLX",
]


def create_market_data_provider(
    cache: PriceCache,
    tickers: list[str] | None = None,
) -> MarketDataProvider:
    """
    Returns MassiveMarketData if MASSIVE_API_KEY is set, else SimulatorMarketData.
    """
    watched = tickers or DEFAULT_TICKERS
    api_key = os.getenv("MASSIVE_API_KEY", "").strip()

    if api_key:
        from .massive import MassiveMarketData
        # Paid tier: poll every 2s. Free tier (5 calls/min): poll every 15s.
        # Detect free tier heuristically — users can override via env var.
        interval = float(os.getenv("MASSIVE_POLL_INTERVAL", "15.0"))
        return MassiveMarketData(api_key=api_key, cache=cache, tickers=watched, poll_interval=interval)

    from .simulator import SimulatorMarketData
    return SimulatorMarketData(cache=cache, tickers=watched)
```

---

## Module Layout

```
backend/
└── market/
    ├── __init__.py       # exports: create_market_data_provider, PriceCache, PriceUpdate
    ├── base.py           # MarketDataProvider ABC
    ├── cache.py          # PriceCache
    ├── models.py         # PriceUpdate dataclass
    ├── factory.py        # create_market_data_provider()
    ├── massive.py        # MassiveMarketData
    └── simulator.py      # SimulatorMarketData (see MARKET_SIMULATOR.md)
```

---

## FastAPI Integration

```python
# backend/main.py (relevant sections)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from market import create_market_data_provider, PriceCache

price_cache = PriceCache()
market: MarketDataProvider | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global market
    # Load watchlist tickers from DB at startup
    tickers = await db.get_watchlist_tickers()
    market = create_market_data_provider(price_cache, tickers)
    await market.start()
    yield
    await market.stop()


app = FastAPI(lifespan=lifespan)
```

---

## SSE Stream

The SSE endpoint reads from the cache on a fixed cadence and pushes updates to all connected clients. It does not call the market provider directly — the provider writes to the cache independently.

```python
# backend/routes/stream.py
import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from market import PriceCache

router = APIRouter()

async def price_event_generator(cache: PriceCache):
    while True:
        prices = await cache.get_all()
        if prices:
            payload = {
                ticker: {
                    "ticker": u.ticker,
                    "price": u.price,
                    "prev_price": u.prev_price,
                    "change": round(u.change, 4),
                    "change_pct": round(u.change_pct, 4),
                    "direction": u.direction,
                    "timestamp": u.timestamp.isoformat(),
                }
                for ticker, u in prices.items()
            }
            yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(0.5)


@router.get("/api/stream/prices")
async def stream_prices():
    return StreamingResponse(
        price_event_generator(price_cache),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

---

## SSE Event Shape

Each SSE event carries a JSON object keyed by ticker:

```json
{
  "AAPL": {
    "ticker": "AAPL",
    "price": 191.95,
    "prev_price": 189.50,
    "change": 2.45,
    "change_pct": 1.2929,
    "direction": "up",
    "timestamp": "2026-06-18T14:30:00.123456"
  },
  "GOOGL": {
    "ticker": "GOOGL",
    "price": 174.20,
    "prev_price": 175.00,
    "change": -0.80,
    "change_pct": -0.4571,
    "direction": "down",
    "timestamp": "2026-06-18T14:30:00.123456"
  }
}
```

The frontend receives this as one `MessageEvent` per 500ms tick. Each ticker's entry is an atomic snapshot — no separate events per ticker.

---

## Watchlist Changes at Runtime

When the user adds or removes a ticker via the REST API or AI chat, the backend must notify the market provider:

```python
# In the watchlist POST handler:
await db.add_to_watchlist(ticker)
market.add_ticker(ticker)   # Massive: adds to next poll; Simulator: starts simulating

# In the watchlist DELETE handler:
await db.remove_from_watchlist(ticker)
market.remove_ticker(ticker)
```

Both `MassiveMarketData` and `SimulatorMarketData` expose `add_ticker` / `remove_ticker` for this purpose.
