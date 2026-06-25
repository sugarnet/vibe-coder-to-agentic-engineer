# Market Data Backend — Design & Implementation Guide

This document is the definitive reference for the FinAlly market data subsystem. It covers the full architecture, all data types, both provider implementations (GBM simulator and Massive API), the shared price cache, SSE streaming, FastAPI integration, and how watchlist changes propagate at runtime.

The implementation lives in `backend/app/market/`. All files described here exist and are tested.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Application                         │
│                                                                 │
│   Lifespan:                                                     │
│     source = create_market_data_source(cache)                   │
│     await source.start(tickers)                                 │
│                          │                                      │
│                          ▼ writes every 500ms                   │
│                    ┌──────────────┐                             │
│                    │  PriceCache  │  (in-memory, thread-safe)   │
│                    └──────┬───────┘                             │
│                           │ reads every 500ms                   │
│                           ▼                                     │
│                 GET /api/stream/prices (SSE)                    │
│                 GET /api/watchlist     (REST)                   │
│                 POST /api/portfolio/trade (REST)                │
└─────────────────────────────────────────────────────────────────┘

MarketDataSource (abstract)
       ├── SimulatorDataSource   (default; no external deps)
       └── MassiveDataSource     (real data; requires MASSIVE_API_KEY)
```

**Key invariant:** All downstream code (SSE, portfolio, watchlist) reads from `PriceCache` only. It never calls `MarketDataSource` directly. The source writes to the cache independently on its own schedule.

---

## Module Layout

```
backend/app/market/
├── __init__.py          # Public API exports
├── interface.py         # MarketDataSource ABC
├── models.py            # PriceUpdate dataclass
├── cache.py             # PriceCache
├── factory.py           # create_market_data_source()
├── simulator.py         # SimulatorDataSource + GBMSimulator
├── massive_client.py    # MassiveDataSource
├── seed_prices.py       # Seed prices, per-ticker params, correlations
└── stream.py            # SSE streaming router factory
```

Import everything you need from the package root:

```python
from app.market import (
    PriceUpdate,
    PriceCache,
    MarketDataSource,
    create_market_data_source,
    create_stream_router,
)
```

---

## Data Model: `PriceUpdate`

`PriceUpdate` is an immutable frozen dataclass. Every price event in the system is represented as one.

```python
# backend/app/market/models.py
import time
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds

    @property
    def change(self) -> float:
        """Absolute price change: price - previous_price, rounded to 4dp."""
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from previous price, rounded to 4dp."""
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

### Example values

```python
update = PriceUpdate(ticker="AAPL", price=191.95, previous_price=189.50)
update.change         # 2.45
update.change_percent # 1.2963
update.direction      # "up"
update.to_dict()
# {
#   "ticker": "AAPL",
#   "price": 191.95,
#   "previous_price": 189.5,
#   "timestamp": 1750258200.123,
#   "change": 2.45,
#   "change_percent": 1.2963,
#   "direction": "up"
# }
```

**Note:** `price` is stored rounded to 2 decimal places by the cache (cents). Properties `change` and `change_percent` are computed on access, rounded to 4 decimal places.

---

## Shared Price Cache: `PriceCache`

The cache is the single source of truth for current prices in the running process. It uses a `threading.Lock` (not `asyncio.Lock`) because the Massive client runs its synchronous HTTP call in a thread via `asyncio.to_thread`.

```python
# backend/app/market/cache.py
from threading import Lock
from .models import PriceUpdate
import time

class PriceCache:
    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0  # Monotonically increases on every update

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. Returns the PriceUpdate that was stored.

        previous_price is automatically taken from the prior entry for this ticker.
        On first update for a ticker, previous_price == price (direction='flat').
        """
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

    def get_price(self, ticker: str) -> float | None:
        """Convenience: just the float price, or None."""
        update = self.get(ticker)
        return update.price if update else None

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot of all current prices. Returns a shallow copy."""
        with self._lock:
            return dict(self._prices)

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        """Increments on every update. Used by SSE to detect new data."""
        return self._version

    def __len__(self) -> int:
        with self._lock:
            return len(self._prices)

    def __contains__(self, ticker: str) -> bool:
        with self._lock:
            return ticker in self._prices
```

### Usage examples

```python
cache = PriceCache()

# Producer writes:
cache.update("AAPL", 191.95)
cache.update("AAPL", 192.10)   # previous_price auto-set to 191.95

# Consumer reads:
update = cache.get("AAPL")
update.price          # 192.10
update.previous_price # 191.95
update.direction      # "up"

price = cache.get_price("AAPL")   # 192.10 (float)
all_prices = cache.get_all()      # {"AAPL": PriceUpdate(...), ...}

# Version-based change detection:
v1 = cache.version       # e.g., 42
cache.update("AAPL", 192.50)
v2 = cache.version       # 43 — SSE loop knows to send an event
```

---

## Abstract Interface: `MarketDataSource`

All provider implementations satisfy this contract.

```python
# backend/app/market/interface.py
from abc import ABC, abstractmethod

class MarketDataSource(ABC):
    """Contract for market data providers.

    Lifecycle:
        source = create_market_data_source(cache)
        await source.start(["AAPL", "GOOGL", ...])
        # app running — user adds/removes tickers:
        await source.add_ticker("PYPL")
        await source.remove_ticker("NFLX")
        # app shutting down:
        await source.stop()
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Start the background loop for the given initial tickers.
        Must be called exactly once. Seeds the cache immediately."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background loop. Safe to call multiple times."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. Seeds the cache immediately.
        No-op if already present."""

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the active set and from the cache.
        No-op if not present."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return the currently tracked tickers."""
```

---

## Factory: `create_market_data_source`

Call this once at application startup. It reads `MASSIVE_API_KEY` from the environment and returns the right implementation.

```python
# backend/app/market/factory.py
import os
import logging
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Return MassiveDataSource if MASSIVE_API_KEY is set, else SimulatorDataSource."""
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        logger.info("Market data source: Massive API (real data)")
        from .massive_client import MassiveDataSource
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        from .simulator import SimulatorDataSource
        return SimulatorDataSource(price_cache=price_cache)
```

### Environment variable behavior

| `MASSIVE_API_KEY` | Provider selected |
|---|---|
| Unset or empty | `SimulatorDataSource` |
| Any non-empty string | `MassiveDataSource` |

Optional tuning via environment:

| Variable | Default | Effect |
|---|---|---|
| `MASSIVE_API_KEY` | `""` | Enables Massive API |
| `MASSIVE_POLL_INTERVAL` | `15.0` | Seconds between Massive polls (use `2.0` on paid tier) |

---

## Simulator Implementation

### Why Geometric Brownian Motion

GBM is the foundational model for equity prices in the Black-Scholes framework:

```
S(t+dt) = S(t) × exp((μ - σ²/2) × dt  +  σ × √dt × Z)
```

Where:
- `S(t)` — current price
- `μ` (mu) — annualized drift (expected return, e.g. 0.08 = 8%/year)
- `σ` (sigma) — annualized volatility (e.g. 0.25 = 25%/year)
- `dt` — time step as fraction of a trading year
- `Z` — standard normal random variable

For 500ms ticks:

```python
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
dt = 0.5 / TRADING_SECONDS_PER_YEAR           # ~8.48e-8
```

This tiny `dt` produces sub-cent moves per tick that compound naturally.

### Correlated Moves via Cholesky Decomposition

Real stocks move together, especially within sectors. The simulator builds a correlation matrix at startup (and whenever tickers are added/removed) and uses Cholesky decomposition to produce correlated draws.

```python
# Correlation matrix entry for tickers i and j:
#   Same tech sector:    0.6
#   Same finance sector: 0.5
#   Cross-sector:        0.3
#   TSLA with anything:  0.3 (does its own thing)
#   Unknown tickers:     0.3

import numpy as np

# n independent normals → correlated normals
z_independent = np.random.standard_normal(n)
z_correlated = cholesky_matrix @ z_independent   # shape (n,)

# Then for each ticker i:
drift = (mu - 0.5 * sigma**2) * dt
diffusion = sigma * math.sqrt(dt) * z_correlated[i]
new_price = old_price * math.exp(drift + diffusion)
```

### Seed Prices and Per-Ticker Parameters

```python
# backend/app/market/seed_prices.py

SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00,
    "GOOGL": 175.00,
    "MSFT": 420.00,
    "AMZN": 185.00,
    "TSLA": 250.00,
    "NVDA": 800.00,
    "META": 500.00,
    "JPM":  195.00,
    "V":    280.00,
    "NFLX": 600.00,
}

TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL": {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT": {"sigma": 0.20, "mu": 0.05},
    "AMZN": {"sigma": 0.28, "mu": 0.05},
    "TSLA": {"sigma": 0.50, "mu": 0.03},  # High volatility
    "NVDA": {"sigma": 0.40, "mu": 0.08},  # High vol, strong upward drift
    "META": {"sigma": 0.30, "mu": 0.05},
    "JPM":  {"sigma": 0.18, "mu": 0.04},  # Low vol (bank)
    "V":    {"sigma": 0.17, "mu": 0.04},  # Low vol (payments)
    "NFLX": {"sigma": 0.35, "mu": 0.05},
}

DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}  # For unknown tickers

CORRELATION_GROUPS: dict[str, set[str]] = {
    "tech":    {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"},
    "finance": {"JPM", "V"},
}

INTRA_TECH_CORR    = 0.6
INTRA_FINANCE_CORR = 0.5
CROSS_GROUP_CORR   = 0.3
TSLA_CORR          = 0.3
```

Unknown tickers (user-added at runtime) use `DEFAULT_PARAMS` and a seed price of a random value between $50–$300.

### Random Jump Events

Every tick, each ticker has a 0.1% chance of a sudden 2–5% move in either direction. This simulates earnings surprises and news events.

```python
EVENT_PROBABILITY = 0.001   # 0.1% per tick
# With 10 tickers at 2 ticks/sec → ~1 event every 50 seconds

if random.random() < event_probability:
    shock_magnitude = random.uniform(0.02, 0.05)   # 2–5%
    shock_sign = random.choice([-1, 1])
    price *= 1 + shock_magnitude * shock_sign
```

### Full `GBMSimulator` Class

```python
# backend/app/market/simulator.py  (core class)
import math, random, numpy as np

class GBMSimulator:
    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR  # ~8.48e-8

    def __init__(self, tickers: list[str], dt: float = DEFAULT_DT,
                 event_probability: float = 0.001) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        for ticker in tickers:
            self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """Advance all tickers by one dt. Returns {ticker: new_price}."""
        n = len(self._tickers)
        if n == 0:
            return {}

        z = np.linalg.cholesky(self._build_corr_matrix()) @ np.random.standard_normal(n) \
            if self._cholesky is None else self._cholesky @ np.random.standard_normal(n)

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= 1 + shock

            result[ticker] = round(self._prices[ticker], 2)
        return result

    def add_ticker(self, ticker: str) -> None:
        """Add ticker and rebuild Cholesky. O(n²) but n is always small."""
        if ticker in self._prices:
            return
        self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        if ticker not in self._prices:
            return
        self._tickers.remove(ticker)
        del self._prices[ticker]
        del self._params[ticker]
        self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)
```

### `SimulatorDataSource` — The Async Wrapper

`GBMSimulator` is pure CPU math; `SimulatorDataSource` wraps it in an asyncio background task.

```python
class SimulatorDataSource(MarketDataSource):
    def __init__(self, price_cache: PriceCache, update_interval: float = 0.5,
                 event_probability: float = 0.001) -> None:
        self._cache = price_cache
        self._interval = update_interval
        self._event_prob = event_probability
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        # Seed cache immediately so SSE has data before the first tick fires
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def add_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.add_ticker(ticker)
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)  # immediate seed

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

### Simulator behavior summary

| Property | Value |
|---|---|
| Tick interval | 500ms |
| Price model | GBM with Cholesky correlated normals |
| Jump events | 0.1% chance per ticker per tick (~1 event/50s with 10 tickers) |
| Jump magnitude | 2–5% up or down |
| Unknown tickers | Supported — uses `DEFAULT_PARAMS`, random seed price |
| No external dependencies | Fully in-process, no network calls |

---

## Massive API Implementation

### About Massive (formerly Polygon.io)

Polygon.io rebranded as **Massive** on October 30, 2025. The REST base URL changed from `api.polygon.io` to `api.massive.com`. Both are supported; existing API keys continue to work.

### Rate Limits

| Plan | Calls / min | Data freshness |
|---|---|---|
| Free (Basic) | 5 | End-of-day only |
| Starter | Unlimited | 15-min delayed |
| Developer | Unlimited | Real-time |

Default poll interval: **15 seconds** (4 calls/min on free tier). Set `MASSIVE_POLL_INTERVAL=2` for paid tiers.

### API Endpoint Used

```
GET https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers
    ?tickers=AAPL,GOOGL,MSFT,...
    &apiKey=YOUR_KEY
```

One call fetches all tickers at once — this is the most efficient polling pattern.

### Response Shape

```json
{
  "status": "OK",
  "count": 2,
  "tickers": [
    {
      "ticker": "AAPL",
      "todaysChange": 2.45,
      "todaysChangePerc": 1.28,
      "updated": 1750258200123456789,
      "day":      { "o": 189.50, "h": 192.30, "l": 188.90, "c": 191.95, "v": 54321000, "vw": 191.02 },
      "lastTrade": { "p": 191.95, "s": 100, "t": 1750258200000000000, "x": 4 },
      "lastQuote": { "P": 192.00, "S": 3, "p": 191.90, "s": 2, "t": 1750258200000000000 },
      "prevDay":   { "o": 188.50, "h": 190.20, "l": 188.00, "c": 189.50, "v": 61200000 }
    }
  ]
}
```

Key fields extracted per ticker:
- `lastTrade.p` → `price`
- `lastTrade.t / 1000` → `timestamp` (nanoseconds → seconds)

### `MassiveDataSource` Implementation

```python
# backend/app/market/massive_client.py
import asyncio, logging
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from .cache import PriceCache
from .interface import MarketDataSource

class MassiveDataSource(MarketDataSource):
    def __init__(self, api_key: str, price_cache: PriceCache,
                 poll_interval: float = 15.0) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None
        self._client: RESTClient | None = None

    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = list(tickers)
        await self._poll_once()   # Seed cache immediately on startup
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._client = None

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)
            # Will appear on the next poll cycle (up to poll_interval seconds)

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
        """Fetch all snapshots in one API call, update the cache."""
        if not self._tickers or not self._client:
            return
        try:
            # RESTClient is synchronous — run in a thread to avoid blocking the event loop
            snapshots = await asyncio.to_thread(self._fetch_snapshots)
            for snap in snapshots:
                try:
                    price = snap.last_trade.price
                    timestamp = snap.last_trade.timestamp / 1000.0  # ns → s
                    self._cache.update(ticker=snap.ticker, price=price, timestamp=timestamp)
                except (AttributeError, TypeError) as e:
                    logger.warning("Skipping %s: %s", getattr(snap, "ticker", "?"), e)
        except Exception as e:
            logger.error("Massive poll failed: %s", e)
            # Don't re-raise. Common failures: 401 bad key, 429 rate limit, network error.

    def _fetch_snapshots(self) -> list:
        """Synchronous Massive API call. Always run via asyncio.to_thread."""
        return self._client.get_snapshot_all(
            market_type=SnapshotMarketType.STOCKS,
            tickers=self._tickers,
        )
```

### Error Handling Strategy

| HTTP Status | Behavior |
|---|---|
| 200 | Parse and update cache |
| 401 Unauthorized | Log error, loop continues (will keep retrying every interval) |
| 429 Rate limit | Log error, loop continues (natural backoff via interval) |
| 404 Not found | Log warning per ticker, skip it |
| 5xx Server error | Log error, loop continues |

Errors are swallowed in `_poll_once` — the loop never crashes. Stale cached prices remain until the next successful poll.

### Simulator vs. Massive — differences for consumers

| Aspect | Simulator | Massive |
|---|---|---|
| Update frequency | Every 500ms | Every 15s (free) / 2–5s (paid) |
| `add_ticker` effect | Immediately in next tick | Appears on next poll |
| `timestamp` | Current UTC time | Exchange trade timestamp |
| Price source | GBM math | `lastTrade.price` from exchange |
| `previous_price` | Previous tick's price | Previous cache entry's price |
| Network required | No | Yes |

Both produce identical `PriceUpdate` objects. All consumers are unaffected by which implementation is running.

---

## SSE Streaming: `create_stream_router`

The SSE endpoint reads from `PriceCache` every 500ms and pushes all prices to connected clients. It uses the `version` counter to skip sending events when nothing changed.

```python
# backend/app/market/stream.py
import asyncio, json, logging
from collections.abc import AsyncGenerator
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from .cache import PriceCache

router = APIRouter(prefix="/api/stream", tags=["streaming"])

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    """Factory that binds the router to a specific PriceCache instance."""

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(
            _generate_events(price_cache, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Prevent nginx from buffering the stream
            },
        )

    return router


async def _generate_events(
    price_cache: PriceCache,
    request: Request,
    interval: float = 0.5,
) -> AsyncGenerator[str, None]:
    yield "retry: 1000\n\n"   # Tell browser to reconnect after 1s on disconnect

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

### SSE Event Shape

Each event's `data` field is a JSON object keyed by ticker symbol:

```json
{
  "AAPL": {
    "ticker": "AAPL",
    "price": 191.95,
    "previous_price": 189.50,
    "timestamp": 1750258200.123,
    "change": 2.45,
    "change_percent": 1.2963,
    "direction": "up"
  },
  "GOOGL": {
    "ticker": "GOOGL",
    "price": 174.20,
    "previous_price": 175.00,
    "timestamp": 1750258200.123,
    "change": -0.80,
    "change_percent": -0.4571,
    "direction": "down"
  }
}
```

One `MessageEvent` per 500ms tick. All tickers in a single event — no per-ticker events.

### Frontend consumption

```typescript
const source = new EventSource("/api/stream/prices");

source.onmessage = (event) => {
  const prices: Record<string, PriceUpdate> = JSON.parse(event.data);
  for (const [ticker, update] of Object.entries(prices)) {
    updateTickerDisplay(ticker, update);  // trigger flash animation
  }
};

source.onerror = () => {
  // EventSource reconnects automatically after the retry: 1000ms directive
};
```

### TypeScript interface for frontend

```typescript
interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;       // Unix seconds
  change: number;          // price - previous_price
  change_percent: number;  // percentage change
  direction: "up" | "down" | "flat";
}
```

---

## FastAPI Integration

Wire everything together in the application lifespan:

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.market import PriceCache, create_market_data_source, create_stream_router

# Module-level singletons — shared across all requests
price_cache = PriceCache()
market_source = None   # set in lifespan


@asynccontextmanager
async def lifespan(app: FastAPI):
    global market_source

    # Load watchlist from database
    tickers = await db.get_watchlist_tickers()  # returns list[str]

    # Start market data (simulator or Massive based on env)
    market_source = create_market_data_source(price_cache)
    await market_source.start(tickers)

    yield  # App is running

    # Graceful shutdown
    await market_source.stop()


app = FastAPI(lifespan=lifespan)

# Register SSE router (binds it to our price_cache instance)
app.include_router(create_stream_router(price_cache))

# Other routers (portfolio, watchlist, chat, health)
# app.include_router(portfolio_router)
# app.include_router(watchlist_router)
# ...

# Serve Next.js static export (catch-all, must be last)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### Watchlist add/remove handlers

When the user adds or removes a ticker, notify both the database and the market source:

```python
# backend/app/routes/watchlist.py
from fastapi import APIRouter
from app.market import MarketDataSource, PriceCache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

# These are injected at app startup (or via FastAPI Depends)
# market_source: MarketDataSource
# price_cache: PriceCache


@router.post("")
async def add_ticker(body: AddTickerRequest):
    ticker = body.ticker.upper().strip()

    # 1. Persist to database
    await db.add_to_watchlist(ticker)

    # 2. Notify market source — starts simulating / includes in next poll
    await market_source.add_ticker(ticker)

    # 3. Return immediately — price will appear in SSE within 500ms (sim) or next poll (Massive)
    price = price_cache.get(ticker)
    return {"ticker": ticker, "price": price.to_dict() if price else None}


@router.delete("/{ticker}")
async def remove_ticker(ticker: str):
    ticker = ticker.upper().strip()

    await db.remove_from_watchlist(ticker)
    await market_source.remove_ticker(ticker)   # also removes from cache

    return {"removed": ticker}
```

---

## Runtime Watchlist Management

Both implementations handle dynamic ticker changes without restart:

```
User calls POST /api/watchlist {"ticker": "PYPL"}
    │
    ├─► db.add_to_watchlist("PYPL")
    └─► market_source.add_ticker("PYPL")
           │
           ├─ [Simulator] GBMSimulator.add_ticker("PYPL")
           │    ├─ Assigns DEFAULT_PARAMS (sigma=0.25, mu=0.05)
           │    ├─ Seeds price to random $50–$300
           │    ├─ Rebuilds Cholesky correlation matrix
           │    └─ cache.update("PYPL", seed_price)  ← immediate!
           │
           └─ [Massive] Appends "PYPL" to self._tickers list
                └─ Will be included in next _poll_once() call

User calls DELETE /api/watchlist/NFLX
    │
    ├─► db.remove_from_watchlist("NFLX")
    └─► market_source.remove_ticker("NFLX")
           ├─ [Simulator] GBMSimulator.remove_ticker("NFLX")
           │    └─ cache.remove("NFLX")
           └─ [Massive] Removes from list + cache.remove("NFLX")

SSE stream: after remove, "NFLX" no longer appears in events.
```

---

## Testing

### Unit tests — simulator

```python
# backend/tests/market/test_simulator.py
import asyncio
import pytest
from app.market.cache import PriceCache
from app.market.simulator import SimulatorDataSource, GBMSimulator

@pytest.mark.asyncio
async def test_prices_update_every_tick():
    cache = PriceCache()
    source = SimulatorDataSource(cache, update_interval=0.1)
    await source.start(["AAPL", "GOOGL"])
    await asyncio.sleep(0.35)   # ~3 ticks
    await source.stop()

    all_prices = cache.get_all()
    assert "AAPL" in all_prices
    assert "GOOGL" in all_prices
    assert all_prices["AAPL"].price > 0


@pytest.mark.asyncio
async def test_add_unknown_ticker():
    cache = PriceCache()
    source = SimulatorDataSource(cache, update_interval=0.1)
    await source.start(["AAPL"])
    await source.add_ticker("PLTR")   # Not in TICKER_CONFIGS
    await asyncio.sleep(0.2)
    await source.stop()

    assert "PLTR" in cache
    update = cache.get("PLTR")
    assert update.price > 0


@pytest.mark.asyncio
async def test_remove_ticker_clears_cache():
    cache = PriceCache()
    source = SimulatorDataSource(cache, update_interval=0.1)
    await source.start(["AAPL", "GOOGL"])
    await asyncio.sleep(0.2)
    await source.remove_ticker("GOOGL")

    assert "GOOGL" not in cache
    assert "AAPL" in cache


def test_gbm_step_produces_positive_prices():
    sim = GBMSimulator(["AAPL", "TSLA"])
    for _ in range(100):
        prices = sim.step()
        for ticker, price in prices.items():
            assert price > 0, f"{ticker} went non-positive"


def test_gbm_correlated_moves():
    """Correlated tickers should not produce identical moves (which would mean
    they share a single draw rather than correlated-but-distinct draws)."""
    sim = GBMSimulator(["AAPL", "MSFT"])   # Both tech, corr=0.6
    prices_before = {"AAPL": sim.get_price("AAPL"), "MSFT": sim.get_price("MSFT")}
    prices_after = sim.step()
    assert prices_after["AAPL"] != prices_after["MSFT"]
    # Moves should not be identical (probability zero with continuous distributions)
    delta_aapl = prices_after["AAPL"] - prices_before["AAPL"]
    delta_msft = prices_after["MSFT"] - prices_before["MSFT"]
    assert delta_aapl != delta_msft
```

### Unit tests — cache

```python
# backend/tests/market/test_cache.py
from app.market.cache import PriceCache

def test_first_update_has_flat_direction():
    cache = PriceCache()
    update = cache.update("AAPL", 190.00)
    assert update.direction == "flat"
    assert update.previous_price == 190.00

def test_second_update_tracks_previous():
    cache = PriceCache()
    cache.update("AAPL", 190.00)
    update = cache.update("AAPL", 192.50)
    assert update.previous_price == 190.00
    assert update.direction == "up"
    assert update.change == 2.50

def test_version_increments_on_update():
    cache = PriceCache()
    v0 = cache.version
    cache.update("AAPL", 100.0)
    assert cache.version == v0 + 1
    cache.update("AAPL", 101.0)
    assert cache.version == v0 + 2

def test_remove_clears_ticker():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    assert "AAPL" in cache
    cache.remove("AAPL")
    assert "AAPL" not in cache
    assert cache.get("AAPL") is None

def test_get_all_returns_copy():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    snapshot = cache.get_all()
    snapshot["FAKE"] = None   # Modifying the copy must not affect the cache
    assert "FAKE" not in cache.get_all()
```

### Unit tests — Massive client (mocked)

```python
# backend/tests/market/test_massive.py
import asyncio
from unittest.mock import MagicMock, patch
import pytest
from app.market.cache import PriceCache
from app.market.massive_client import MassiveDataSource

def make_mock_snapshot(ticker: str, price: float, ts_ns: int = 1750258200_000_000_000):
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade.price = price
    snap.last_trade.timestamp = ts_ns
    return snap

@pytest.mark.asyncio
async def test_start_seeds_cache_immediately():
    cache = PriceCache()
    source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)

    mock_snaps = [make_mock_snapshot("AAPL", 191.95), make_mock_snapshot("GOOGL", 174.20)]

    with patch.object(source, "_fetch_snapshots", return_value=mock_snaps):
        await source.start(["AAPL", "GOOGL"])
        await source.stop()

    assert cache.get_price("AAPL") == 191.95
    assert cache.get_price("GOOGL") == 174.20


@pytest.mark.asyncio
async def test_poll_failure_does_not_crash():
    cache = PriceCache()
    source = MassiveDataSource(api_key="bad-key", price_cache=cache, poll_interval=0.1)

    with patch.object(source, "_fetch_snapshots", side_effect=Exception("401 Unauthorized")):
        await source.start([])
        await asyncio.sleep(0.25)   # Let a few failing polls run
        await source.stop()

    # Cache is empty but no exception was raised
    assert len(cache) == 0


@pytest.mark.asyncio
async def test_remove_ticker_clears_cache():
    cache = PriceCache()
    source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)

    with patch.object(source, "_fetch_snapshots", return_value=[make_mock_snapshot("AAPL", 190.0)]):
        await source.start(["AAPL"])
        await source.stop()

    assert "AAPL" in cache
    await source.remove_ticker("AAPL")
    assert "AAPL" not in cache
```

### Running tests

```bash
cd finally/backend
uv run --extra dev pytest tests/market/ -v
uv run --extra dev pytest --cov=app/market tests/market/
```

---

## Demo Script

A terminal dashboard is included for manual verification:

```bash
cd finally/backend
uv run market_data_demo.py
```

This runs the simulator and prints a live updating price table to the terminal. Useful for verifying GBM behavior and jump events without starting the full FastAPI app.

---

## Checklist for Consuming Code

When writing code that uses market data:

- [ ] Read from `PriceCache`, not from `MarketDataSource`
- [ ] Use `cache.get_price(ticker)` for a single float, `cache.get(ticker)` for the full `PriceUpdate`
- [ ] Handle `None` — a ticker may not yet have a price if the first poll hasn't completed
- [ ] For watchlist add: call both `db.add_to_watchlist(ticker)` and `await market_source.add_ticker(ticker)`
- [ ] For watchlist remove: call both `db.remove_from_watchlist(ticker)` and `await market_source.remove_ticker(ticker)`
- [ ] For portfolio valuation: sum `cache.get_price(ticker) * quantity` for each position
- [ ] `PriceUpdate.to_dict()` is the canonical JSON shape for all API responses involving prices
