# Market Simulator

Approach and code structure for simulating realistic stock prices when `MASSIVE_API_KEY` is not set.

---

## Overview

The simulator uses **Geometric Brownian Motion (GBM)** to generate continuous, realistic-looking price paths. GBM is the standard stochastic process underlying Black-Scholes — prices can't go negative, produce lognormal returns, and drift over time. At 500ms ticks it generates sub-cent moves per step that accumulate naturally into visible intraday swings.

Three layers of realism:

1. **Per-ticker volatility** — TSLA bounces more than JPM
2. **Correlated sector moves** — tech stocks move together; random Z's pass through a Cholesky decomposition
3. **Random shock events** — ~0.1% chance per tick of a 2–5% sudden move for visual drama

---

## GBM Mathematics

The discrete GBM update rule for one time step:

```
S(t + dt) = S(t) × exp((μ - σ²/2) × dt + σ × √dt × Z)
```

| Symbol | Meaning |
|--------|---------|
| `S(t)` | Price at current step |
| `μ` (mu) | Annualized drift (expected return), e.g. 0.05 = 5%/year |
| `σ` (sigma) | Annualized volatility, e.g. 0.25 = 25%/year |
| `dt` | Time step as fraction of a trading year |
| `Z` | Standard normal random variable, N(0,1) |

**Why the `σ²/2` correction?** GBM applies to log prices. The Itô correction `−σ²/2` makes the expected price match the drift `μ` (without it, Jensen's inequality would cause the mean to drift too fast).

**Computing `dt`** for 500ms ticks:

```
Trading year ≈ 252 days × 6.5 hours/day × 3600 s/hour = 5,896,800 seconds
dt = 0.5 / 5,896,800 ≈ 8.48 × 10⁻⁸
```

This tiny `dt` produces moves on the order of:

```
σ × √dt ≈ 0.25 × √(8.48e-8) ≈ 0.000073 (0.007% per tick)
```

For a $200 stock: ~$0.015 typical per-tick move. Over a simulated trading day (~47,000 ticks), this accumulates to realistic intraday ranges.

---

## Correlated Moves

Real stocks in the same sector move together. NVDA and MSFT tend to rise and fall on the same days. We model this with a **Cholesky decomposition** of a correlation matrix.

**Why Cholesky?** Given `n` independent standard normals `Z_ind`, we want `n` correlated normals `Z_cor` with covariance matrix `C`:

```
L = cholesky(C)   # lower-triangular, L @ L.T == C
Z_cor = L @ Z_ind
```

The resulting `Z_cor[i]` feeds into ticker `i`'s GBM step. Tickers with high correlation share similar random draws.

**Correlation structure** used in FinAlly:

| Pair | Correlation | Reason |
|------|-------------|--------|
| Tech × Tech | 0.6 | AAPL, GOOGL, MSFT, AMZN, META, NVDA, NFLX |
| Finance × Finance | 0.5 | JPM, V |
| TSLA × anything | 0.3 | TSLA is idiosyncratic |
| Cross-sector | 0.3 | baseline market-wide correlation |
| Unknown tickers | 0.3 | conservative default |

The correlation matrix `C` is `n × n` with `C[i,i] = 1` and `C[i,j] = rho(ticker_i, ticker_j)`. Cholesky factorization requires positive semi-definiteness — our correlation values (all ≥ 0.3) guarantee this for the ticker sets we use.

---

## Shock Events

Every step, each ticker independently draws a uniform random number. If it falls below `event_probability` (default 0.001), a sudden move is applied:

```python
if random.random() < 0.001:
    magnitude = random.uniform(0.02, 0.05)   # 2%–5%
    direction = random.choice([-1, 1])
    price *= (1 + magnitude * direction)
```

With 10 tickers at 2 ticks/second:
- Expected events per ticker: 1 every 500 seconds (~8 min)
- Expected events across all tickers: ~1 every 50 seconds

This keeps the dashboard visually interesting without making prices unrealistic.

---

## Seed Prices and Per-Ticker Parameters

```python
# backend/app/market/seed_prices.py

SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00,
    "GOOGL": 175.00,
    "MSFT":  420.00,
    "AMZN":  185.00,
    "TSLA":  250.00,
    "NVDA":  800.00,
    "META":  500.00,
    "JPM":   195.00,
    "V":     280.00,
    "NFLX":  600.00,
}

TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL":  {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT":  {"sigma": 0.20, "mu": 0.05},
    "AMZN":  {"sigma": 0.28, "mu": 0.05},
    "TSLA":  {"sigma": 0.50, "mu": 0.03},  # High vol, lower expected return
    "NVDA":  {"sigma": 0.40, "mu": 0.08},  # High vol, strong drift
    "META":  {"sigma": 0.30, "mu": 0.05},
    "JPM":   {"sigma": 0.18, "mu": 0.04},  # Low vol (bank)
    "V":     {"sigma": 0.17, "mu": 0.04},  # Low vol (payments)
    "NFLX":  {"sigma": 0.35, "mu": 0.05},
}

# Used for any ticker added dynamically that is not in the table above
DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}

CORRELATION_GROUPS: dict[str, set[str]] = {
    "tech":    {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"},
    "finance": {"JPM", "V"},
}
```

**Tickers not in `SEED_PRICES`** start at a random price between $50 and $300.

**`sigma` calibration**: `sigma=0.50` for TSLA means 50% annualized volatility. Over a simulated trading day (252 × 6.5h worth of ticks), this produces roughly the right intraday range relative to a quieter stock like V at 17%.

---

## Implementation

Two classes: `GBMSimulator` (the math engine) and `SimulatorDataSource` (the async wrapper that uses it).

### GBMSimulator

```python
# backend/app/market/simulator.py

import math, random
import numpy as np
from .seed_prices import SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS, CORRELATION_GROUPS

class GBMSimulator:
    """Correlated GBM price simulator for multiple tickers.

    Call step() every interval to get the next price for each ticker.
    Add/remove tickers at any time — the correlation matrix is rebuilt automatically.
    """

    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR  # ~8.48e-8

    def __init__(
        self,
        tickers: list[str],
        dt: float = DEFAULT_DT,
        event_probability: float = 0.001,
    ) -> None:
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

        z_ind = np.random.standard_normal(n)
        z = self._cholesky @ z_ind if self._cholesky is not None else z_ind

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift     = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            # Random shock event
            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= (1 + shock)

            result[ticker] = round(self._prices[ticker], 2)

        return result

    def add_ticker(self, ticker: str) -> None:
        if ticker not in self._prices:
            self._add_ticker_internal(ticker)
            self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        if ticker in self._prices:
            self._tickers.remove(ticker)
            del self._prices[ticker]
            del self._params[ticker]
            self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    # --- Internals ---

    def _add_ticker_internal(self, ticker: str) -> None:
        self._tickers.append(ticker)
        self._prices[ticker] = SEED_PRICES.get(ticker, random.uniform(50.0, 300.0))
        self._params[ticker] = dict(TICKER_PARAMS.get(ticker, DEFAULT_PARAMS))

    def _rebuild_cholesky(self) -> None:
        """Rebuild Cholesky of the correlation matrix. O(n²), n < 50."""
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return

        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = self._pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = rho
                corr[j, i] = rho

        self._cholesky = np.linalg.cholesky(corr)

    @staticmethod
    def _pairwise_correlation(t1: str, t2: str) -> float:
        tech    = CORRELATION_GROUPS["tech"]
        finance = CORRELATION_GROUPS["finance"]

        if t1 == "TSLA" or t2 == "TSLA":
            return 0.3
        if t1 in tech and t2 in tech:
            return 0.6
        if t1 in finance and t2 in finance:
            return 0.5
        return 0.3  # cross-sector and unknown tickers
```

### SimulatorDataSource

The async adapter that runs `GBMSimulator.step()` in a loop and writes results to `PriceCache`. See `MARKET_INTERFACE.md` for the full implementation.

```python
class SimulatorDataSource(MarketDataSource):
    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers)
        # Seed cache before starting the loop so SSE has data immediately
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop())

    async def _run_loop(self) -> None:
        while True:
            prices = self._sim.step()
            for ticker, price in prices.items():
                self._cache.update(ticker=ticker, price=price)
            await asyncio.sleep(self._interval)  # 0.5 seconds
```

---

## File Structure

```
backend/app/market/
  simulator.py     # GBMSimulator class + SimulatorDataSource
  seed_prices.py   # SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS, CORRELATION_GROUPS
```

`seed_prices.py` holds only constants. `simulator.py` holds all logic. The two classes are in the same file because `SimulatorDataSource` is a thin wrapper over `GBMSimulator` with no reason to separate them.

---

## Behavior Notes

- **Prices never go negative**: GBM is multiplicative (`exp()` is always positive).
- **Cholesky rebuild cost**: O(n²) but n < 50 tickers in practice; negligible.
- **Dynamic tickers**: Any string can be added as a ticker. Unknown tickers start at a random $50–$300 price with default volatility params.
- **`dt` is not wall-clock time**: It's a fraction of a trading year. The simulator runs at real-time 500ms intervals, but the financial model treats each step as a ~8.5e-8 year. This means the simulated volatility matches the real annualized figures (TSLA ≈ 50%/year) while producing visually appropriate tick-to-tick moves.
- **Correlation matrix validity**: All off-diagonal entries are ≥ 0.3 and ≤ 0.6. This range is well within positive semi-definiteness bounds; Cholesky will not fail.
- **Shock events are independent**: The correlation matrix applies only to the GBM diffusion term. Shock events use `random.random()` independently per ticker — a shock on AAPL does not trigger one on MSFT.
