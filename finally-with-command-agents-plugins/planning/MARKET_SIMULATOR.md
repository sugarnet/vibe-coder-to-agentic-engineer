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

Real stocks in the same sector move together. The simulator uses **Cholesky decomposition** of a full pairwise correlation matrix to produce correlated standard-normal draws each tick:

```
Z_correlated = L @ Z_independent
```

where `L` is the lower-triangular Cholesky factor of the correlation matrix `C`, and `Z_independent` is a vector of independent standard normals.

Pairwise correlations are assigned by sector:
- Same tech sector: 0.6
- Same finance sector: 0.5
- TSLA with any other ticker: 0.3 (fixed, regardless of sector)
- Cross-sector or unknown tickers: 0.3

The correlation matrix is rebuilt via `np.linalg.cholesky()` whenever a ticker is added or removed. This approach is more general than a two-factor model and naturally handles arbitrary correlation structures as the ticker universe grows.

---

## Seed Prices and Per-Ticker Parameters

Defined in `backend/app/market/seed_prices.py`:

```python
SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00, "GOOGL": 175.00, "MSFT": 420.00, "AMZN": 185.00,
    "TSLA": 250.00, "NVDA": 800.00, "META": 500.00,
    "JPM": 195.00, "V": 280.00, "NFLX": 600.00,
}

# sigma: annualized volatility, mu: annualized drift
TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL": {"sigma": 0.22, "mu": 0.05},
    "TSLA": {"sigma": 0.50, "mu": 0.03},  # High volatility
    "NVDA": {"sigma": 0.40, "mu": 0.08},  # High volatility, strong drift
    # ... (see seed_prices.py for full list)
}

# Default for unknown tickers (dynamically added by user)
DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}
# Unknown tickers start at a random price in [50, 300]

# Sector correlation groups
CORRELATION_GROUPS = {
    "tech":    {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"},
    "finance": {"JPM", "V"},
}
INTRA_TECH_CORR    = 0.6
INTRA_FINANCE_CORR = 0.5
CROSS_GROUP_CORR   = 0.3
TSLA_CORR          = 0.3  # TSLA gets fixed low correlation regardless of sector
```

---

## Random Jump Events

To add drama, each tick has a small probability of a sudden price jump. Jumps simulate earnings surprises, news events, and circuit breakers.

```python
JUMP_PROBABILITY = 0.001   # 0.1% chance per tick per ticker (~1 event per 1000 ticks ≈ 8 minutes)
JUMP_SIZE_MIN = 0.02        # minimum 2% move
JUMP_SIZE_MAX = 0.05        # maximum 5% move
```

When a jump fires:
1. Direction is chosen uniformly at random (up or down).
2. Magnitude is drawn uniformly from `[JUMP_SIZE_MIN, JUMP_SIZE_MAX]`.
3. The jump is applied multiplicatively on top of the normal GBM step.

---

## Implementation

The actual implementation lives in `backend/app/market/simulator.py` and uses two classes:

- **`GBMSimulator`** — pure-Python math class with no I/O. Holds the current price vector and the cached Cholesky factor. `step()` is the hot path (called every 500ms); it generates correlated normal draws via `L @ z` where `L` is rebuilt with `np.linalg.cholesky()` whenever the ticker list changes.
- **`SimulatorDataSource`** — `MarketDataSource` wrapper. Owns the asyncio background task that calls `GBMSimulator.step()` and writes results to `PriceCache`.

Key implementation notes:
- `GBMSimulator._rebuild_cholesky()` is called on `add_ticker()` / `remove_ticker()`. O(n²) but fine for n < 50.
- `SimulatorDataSource.add_ticker()` seeds the cache immediately (unlike `MassiveDataSource.add_ticker()` which triggers a poll).
- The background loop catches all `Exception` subclasses so a single bad tick does not kill the loop.
- Per-ticker GBM parameters (mu, sigma) and seed prices are defined in `seed_prices.py`.

---

## Behavior Summary

| Property | Value |
|----------|-------|
| Tick interval | 500ms |
| Price model | Geometric Brownian Motion |
| Correlation | Cholesky decomposition of full pairwise correlation matrix |
| Jump events | ~0.1% chance per ticker per tick |
| Jump magnitude | 2–5% |
| Unknown tickers | Supported via `DEFAULT_PARAMS` (seed $50–$300 random, σ=30%) |
| Price floor | None (GBM is unbounded below but stays positive) |
| Price ceiling | None |
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
# backend/tests/market/test_simulator_source.py
import asyncio
import pytest
from app.market.cache import PriceCache
from app.market.simulator import SimulatorDataSource

@pytest.mark.asyncio
async def test_prices_change_over_time():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    await source.start(["AAPL", "GOOGL"])
    initial_version = cache.version
    await asyncio.sleep(0.5)  # several ticks
    await source.stop()

    assert cache.version > initial_version
    assert cache.get("AAPL") is not None
    assert cache.get("AAPL").price > 0


@pytest.mark.asyncio
async def test_add_unknown_ticker():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    await source.start(["AAPL"])

    await source.add_ticker("PLTR")  # not in SEED_PRICES
    assert "PLTR" in source.get_tickers()
    # Cache seeded immediately on add_ticker()
    assert cache.get("PLTR") is not None

    await source.stop()
```
