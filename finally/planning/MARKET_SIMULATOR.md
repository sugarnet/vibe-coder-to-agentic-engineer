# Market Data Simulator

The simulator generates realistic-looking stock price movements using Geometric Brownian Motion (GBM) with correlated noise, occasional jump events, and configurable per-ticker parameters. It runs as an asyncio background task and writes to the shared `PriceCache` at ~500ms intervals.

---

## Why Geometric Brownian Motion

GBM is the standard model for equity prices in the Black-Scholes framework. A price evolves as:

```
S(t + dt) = S(t) * exp((μ - σ²/2) * dt + σ * √dt * Z)
```

where:
- `S(t)` — current price
- `μ` (mu) — annualized drift (expected return)
- `σ` (sigma) — annualized volatility
- `dt` — time step (in years)
- `Z` — standard normal random variable `N(0, 1)`

For a 500ms tick: `dt = 0.5 / (252 * 390 * 60 * 2) ≈ 0.5 / 7,862,400` trading seconds per year. In practice we convert to per-second units and scale by the tick size:

```python
dt = tick_seconds / (252 * 6.5 * 3600)  # fraction of a trading year
```

---

## Correlated Price Moves

Real stocks in the same sector move together. The simulator applies a **two-factor model**:
- A **market factor** shared by all tickers (e.g., index-level move)
- A **sector factor** shared by tickers in the same sector
- An **idiosyncratic factor** unique to each ticker

```
Z_i = beta_market * Z_market + beta_sector * Z_sector_i + sqrt(1 - beta_market² - beta_sector²) * Z_idio_i
```

All `Z` are independent standard normals drawn per tick.

---

## Seed Prices and Per-Ticker Parameters

```python
# backend/market/simulator_config.py
from dataclasses import dataclass

@dataclass
class TickerConfig:
    seed_price: float   # starting price
    mu: float           # annualized drift (e.g. 0.08 = 8% per year)
    sigma: float        # annualized volatility (e.g. 0.30 = 30%)
    sector: str         # for correlation grouping


TICKER_CONFIGS: dict[str, TickerConfig] = {
    "AAPL":  TickerConfig(seed_price=191.00, mu=0.10, sigma=0.28, sector="tech"),
    "GOOGL": TickerConfig(seed_price=175.00, mu=0.09, sigma=0.26, sector="tech"),
    "MSFT":  TickerConfig(seed_price=420.00, mu=0.10, sigma=0.25, sector="tech"),
    "AMZN":  TickerConfig(seed_price=185.00, mu=0.12, sigma=0.30, sector="tech"),
    "TSLA":  TickerConfig(seed_price=175.00, mu=0.08, sigma=0.55, sector="tech"),
    "NVDA":  TickerConfig(seed_price=875.00, mu=0.15, sigma=0.50, sector="tech"),
    "META":  TickerConfig(seed_price=490.00, mu=0.12, sigma=0.32, sector="tech"),
    "JPM":   TickerConfig(seed_price=198.00, mu=0.07, sigma=0.22, sector="finance"),
    "V":     TickerConfig(seed_price=275.00, mu=0.08, sigma=0.20, sector="finance"),
    "NFLX":  TickerConfig(seed_price=640.00, mu=0.10, sigma=0.38, sector="media"),
}

# Market-wide and sector correlation betas
BETA_MARKET = 0.4   # all tickers move with the market factor
BETA_SECTOR = 0.3   # tickers in the same sector share a sector factor
# idiosyncratic beta = sqrt(1 - BETA_MARKET² - BETA_SECTOR²) ≈ 0.80
```

For unknown tickers (user-added), the simulator falls back to generic parameters:

```python
DEFAULT_CONFIG = TickerConfig(seed_price=100.00, mu=0.08, sigma=0.30, sector="unknown")
```

---

## Random Jump Events

To add drama, each tick has a small probability of a sudden price jump. Jumps simulate earnings surprises, news events, and circuit breakers.

```python
JUMP_PROBABILITY = 0.002   # 0.2% chance per tick per ticker (~1 event per 1000 ticks ≈ 8 minutes)
JUMP_SIZE_MIN = 0.02        # minimum 2% move
JUMP_SIZE_MAX = 0.06        # maximum 6% move
```

When a jump fires:
1. Direction is chosen uniformly at random (up or down).
2. Magnitude is drawn uniformly from `[JUMP_SIZE_MIN, JUMP_SIZE_MAX]`.
3. The jump is applied multiplicatively on top of the normal GBM step.

---

## Implementation

```python
# backend/market/simulator.py
import asyncio
import logging
import math
import random
from datetime import datetime

from .base import MarketDataProvider
from .cache import PriceCache
from .models import PriceUpdate
from .simulator_config import (
    TICKER_CONFIGS,
    DEFAULT_CONFIG,
    BETA_MARKET,
    BETA_SECTOR,
    JUMP_PROBABILITY,
    JUMP_SIZE_MIN,
    JUMP_SIZE_MAX,
)

logger = logging.getLogger(__name__)

TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # ~5,896,800


class SimulatorMarketData(MarketDataProvider):
    """
    GBM-based stock price simulator with correlated sector moves and jump events.
    Writes PriceUpdate objects to PriceCache at tick_interval seconds.
    """

    def __init__(
        self,
        cache: PriceCache,
        tickers: list[str],
        tick_interval: float = 0.5,
    ) -> None:
        self._cache = cache
        self._tick_interval = tick_interval
        self._task: asyncio.Task | None = None

        # Current prices per ticker (mutable state)
        self._prices: dict[str, float] = {}
        # Per-ticker config (includes unknowns with DEFAULT_CONFIG)
        self._configs: dict[str, object] = {}

        for ticker in tickers:
            self._init_ticker(ticker)

    def _init_ticker(self, ticker: str) -> None:
        cfg = TICKER_CONFIGS.get(ticker, DEFAULT_CONFIG)
        self._configs[ticker] = cfg
        self._prices[ticker] = cfg.seed_price

    def add_ticker(self, ticker: str) -> None:
        if ticker not in self._prices:
            self._init_ticker(ticker)

    def remove_ticker(self, ticker: str) -> None:
        self._prices.pop(ticker, None)
        self._configs.pop(ticker, None)

    async def start(self) -> None:
        self._task = asyncio.create_task(self._tick_loop())
        logger.info("SimulatorMarketData started, tick_interval=%.2fs", self._tick_interval)

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

    async def _tick_loop(self) -> None:
        while True:
            await self._tick()
            await asyncio.sleep(self._tick_interval)

    async def _tick(self) -> None:
        dt = self._tick_interval / TRADING_SECONDS_PER_YEAR

        # Draw shared market factor
        z_market = random.gauss(0, 1)

        # Group sector factors
        sectors = {cfg.sector for cfg in self._configs.values()}
        z_sector: dict[str, float] = {s: random.gauss(0, 1) for s in sectors}

        updates: list[PriceUpdate] = []
        now = datetime.utcnow()

        for ticker, prev_price in list(self._prices.items()):
            cfg = self._configs[ticker]

            # Idiosyncratic component
            beta_idio = math.sqrt(max(0.0, 1.0 - BETA_MARKET**2 - BETA_SECTOR**2))
            z_i = (
                BETA_MARKET * z_market
                + BETA_SECTOR * z_sector[cfg.sector]
                + beta_idio * random.gauss(0, 1)
            )

            # GBM step
            drift = (cfg.mu - 0.5 * cfg.sigma**2) * dt
            diffusion = cfg.sigma * math.sqrt(dt) * z_i
            new_price = prev_price * math.exp(drift + diffusion)

            # Optional jump event
            if random.random() < JUMP_PROBABILITY:
                jump_size = random.uniform(JUMP_SIZE_MIN, JUMP_SIZE_MAX)
                direction = 1 if random.random() > 0.5 else -1
                new_price *= 1 + direction * jump_size
                logger.debug("Jump event: %s %.2f%%", ticker, direction * jump_size * 100)

            # Clamp to prevent degenerate prices (< $1 or > 10x seed)
            seed = TICKER_CONFIGS.get(ticker, DEFAULT_CONFIG).seed_price
            new_price = max(1.0, min(new_price, seed * 10))

            change = new_price - prev_price
            change_pct = (change / prev_price) * 100 if prev_price else 0.0

            self._prices[ticker] = new_price
            updates.append(PriceUpdate(
                ticker=ticker,
                price=round(new_price, 4),
                prev_price=round(prev_price, 4),
                change=round(change, 4),
                change_pct=round(change_pct, 4),
                timestamp=now,
            ))

        await self._cache.update_many(updates)
```

---

## Behavior Summary

| Property | Value |
|----------|-------|
| Tick interval | 500ms |
| Price model | Geometric Brownian Motion |
| Correlation | Market + sector two-factor model |
| Jump events | ~0.2% chance per ticker per tick |
| Jump magnitude | 2–6% |
| Unknown tickers | Supported via `DEFAULT_CONFIG` (seed $100, σ=30%) |
| Price floor | $1.00 |
| Price ceiling | 10× seed price |
| No external deps | Runs fully in-process; no network calls |

---

## Simulator vs. Real Data — What Stays the Same

Because both `SimulatorMarketData` and `MassiveMarketData` implement `MarketDataProvider` and write identical `PriceUpdate` objects to `PriceCache`, **every layer above the provider is unaffected by which implementation is running**:

- SSE stream endpoint — unchanged
- Portfolio P&L calculation — unchanged  
- Frontend price flash animation — unchanged
- Unit tests for portfolio math — can use simulator directly as a controlled fixture

---

## Testing the Simulator

```python
# backend/tests/test_simulator.py
import asyncio
import pytest
from market.cache import PriceCache
from market.simulator import SimulatorMarketData

@pytest.mark.asyncio
async def test_prices_change_over_time():
    cache = PriceCache()
    sim = SimulatorMarketData(cache=cache, tickers=["AAPL", "GOOGL"])
    await sim.start()
    await asyncio.sleep(1.1)   # let 2 ticks run
    await sim.stop()

    prices = await cache.get_all()
    assert "AAPL" in prices
    assert "GOOGL" in prices
    assert prices["AAPL"].price > 0
    # Prices should have diverged from seed after 2 ticks
    # (probabilistically true; GBM with σ=0.28 almost never stays flat)


@pytest.mark.asyncio
async def test_add_unknown_ticker():
    cache = PriceCache()
    sim = SimulatorMarketData(cache=cache, tickers=["AAPL"])
    sim.add_ticker("PLTR")   # not in TICKER_CONFIGS
    await sim.start()
    await asyncio.sleep(0.6)
    await sim.stop()

    prices = await cache.get_all()
    assert "PLTR" in prices
    # Should start near DEFAULT_CONFIG.seed_price = 100
    assert 90 < prices["PLTR"].price < 110


@pytest.mark.asyncio
async def test_price_stays_above_floor():
    """Price should never go below $1 regardless of noise."""
    cache = PriceCache()
    sim = SimulatorMarketData(cache=cache, tickers=["AAPL"], tick_interval=0.01)
    await sim.start()
    await asyncio.sleep(2.0)   # ~200 ticks
    await sim.stop()

    prices = await cache.get_all()
    assert prices["AAPL"].price >= 1.0
```
