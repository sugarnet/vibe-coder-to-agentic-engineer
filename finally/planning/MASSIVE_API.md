# Massive API Reference (formerly Polygon.io)

Reference for the Massive (formerly Polygon.io) REST and WebSocket API as used in FinAlly.

**Rebrand note**: Polygon.io became Massive.com in October 2025. Existing API keys, base URLs, and the Python client all continue to work. The Python package is now `massive`; `api.polygon.io` is still supported alongside `api.massive.com`.

---

## Setup

```bash
uv add massive
```

Requires Python 3.9+.

```python
from massive import RESTClient

# Reads MASSIVE_API_KEY from environment automatically
client = RESTClient()

# Or pass the key explicitly
client = RESTClient(api_key="your_key_here")
```

**Base URL**: `https://api.massive.com`  
**Auth header**: `Authorization: Bearer <API_KEY>` (handled by the client)

---

## Rate Limits

| Tier | Limit | Recommended poll interval |
|------|-------|--------------------------|
| Free | 5 requests/minute | 15 seconds |
| Paid | Unlimited (stay under ~100 req/s) | 2–5 seconds |

The snapshot endpoint fetches **all requested tickers in one call**, so polling 10 tickers costs 1 request — critical for staying within the free tier.

---

## Endpoints Used in FinAlly

### 1. Snapshot — Multiple Tickers (Primary)

Gets the current price, day OHLCV, and previous close for a list of tickers in a single API call. This is the main endpoint for the Massive polling loop.

**REST**: `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,GOOGL,MSFT`

```python
from massive import RESTClient
from massive.rest.models import SnapshotMarketType

client = RESTClient()

snapshots = client.get_snapshot_all(
    market_type=SnapshotMarketType.STOCKS,
    tickers=["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"],
)

for snap in snapshots:
    price = snap.last_trade.price
    ts    = snap.last_trade.timestamp / 1000.0  # ms → seconds
    pct   = snap.day.change_percent

    print(f"{snap.ticker}: ${price:.2f}  ({pct:+.2f}%)")
    print(f"  Day OHLCV: O={snap.day.open} H={snap.day.high} L={snap.day.low} C={snap.day.close} V={snap.day.volume}")
    print(f"  Prev close: {snap.day.previous_close}")
    print(f"  Bid/Ask:   ${snap.last_quote.bid_price} / ${snap.last_quote.ask_price}")
```

**Snapshot object fields** (per ticker):

| Field | Type | Description |
|-------|------|-------------|
| `ticker` | str | Ticker symbol |
| `last_trade.price` | float | Most recent trade price |
| `last_trade.size` | int | Trade size (shares) |
| `last_trade.exchange` | str | Exchange code |
| `last_trade.timestamp` | int | Unix milliseconds |
| `last_quote.bid_price` | float | NBBO best bid |
| `last_quote.ask_price` | float | NBBO best ask |
| `last_quote.bid_size` | int | Bid size |
| `last_quote.ask_size` | int | Ask size |
| `last_quote.timestamp` | int | Unix milliseconds |
| `day.open` | float | Session open |
| `day.high` | float | Session high |
| `day.low` | float | Session low |
| `day.close` | float | Session close (latest) |
| `day.volume` | float | Session volume |
| `day.vwap` | float | Volume-weighted average price |
| `day.previous_close` | float | Prior session close |
| `day.change` | float | `close - previous_close` |
| `day.change_percent` | float | Percent change from prior close |
| `prev_daily_bar` | object | Prior full session OHLCV |

**Notes**:
- Snapshot data resets daily at 3:30 AM EST and repopulates from ~4:00 AM EST.
- Outside market hours, `last_trade.price` reflects the last executed trade (may include extended-hours).
- The `day` object's `change_percent` is relative to the prior session's close, not the open.

---

### 2. Single Ticker Snapshot

Fetches the same data for one ticker. Use for per-ticker detail views.

```python
snapshot = client.get_snapshot_ticker(
    market_type=SnapshotMarketType.STOCKS,
    ticker="AAPL",
)

print(f"Price: ${snapshot.last_trade.price}")
print(f"Day range: ${snapshot.day.low} – ${snapshot.day.high}")
print(f"Bid/Ask: ${snapshot.last_quote.bid_price} / ${snapshot.last_quote.ask_price}")
```

---

### 3. Previous Close (End-of-Day)

Returns the prior session's OHLCV bar for a ticker.

**REST**: `GET /v2/aggs/ticker/{ticker}/prev`

```python
results = client.get_previous_close_agg(ticker="AAPL")

for bar in results:
    print(f"Previous session: O={bar.open} H={bar.high} L={bar.low} C={bar.close}")
    print(f"Volume: {bar.volume}  VWAP: {bar.vwap}")
    # bar.timestamp is Unix milliseconds
```

**Use cases**:
- Seeding realistic start prices for the simulator when using real data for reference.
- Displaying "yesterday's close" alongside the live price.

---

### 4. Aggregates / Historical Bars (OHLCV)

Returns OHLCV bars over a date range with a configurable timespan.

**REST**: `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`

```python
aggs = []
for bar in client.list_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",       # "minute", "hour", "day", "week", "month"
    from_="2024-01-01",
    to="2024-03-31",
    limit=50000,           # client auto-paginates
):
    aggs.append(bar)

for bar in aggs:
    import datetime
    dt = datetime.datetime.fromtimestamp(bar.timestamp / 1000)
    print(f"{dt.date()}: O={bar.open} H={bar.high} L={bar.low} C={bar.close} V={bar.volume}")
```

**Bar fields**: `open`, `high`, `low`, `close`, `volume`, `vwap`, `transactions`, `timestamp` (ms), `otc`.

Pagination is enabled by default — the client fetches all pages automatically. Disable with `RESTClient(pagination=False)` to get only the first `limit` results.

---

### 5. Last Trade

Returns only the most recent trade (single ticker, synchronous).

```python
trade = client.get_last_trade(ticker="AAPL")
print(f"Last trade: ${trade.price} × {trade.size} shares")
print(f"Exchange: {trade.exchange}  Time: {trade.timestamp}")
```

---

### 6. Last Quote (NBBO)

Returns the current best bid and ask.

```python
quote = client.get_last_quote(ticker="AAPL")
print(f"Bid: ${quote.bid_price} × {quote.bid_size}")
print(f"Ask: ${quote.ask_price} × {quote.ask_size}")
```

---

## WebSocket — Real-Time Trades

For sub-second trade data. The WebSocket client is separate from the REST client and is **not** used in FinAlly (REST polling is sufficient and simpler), but documented here for completeness.

```python
from massive import WebSocketClient
from massive.websocket.models import WebSocketMessage, EquityTrade
from typing import List

def handle_msg(msgs: List[WebSocketMessage]) -> None:
    for m in msgs:
        if isinstance(m, EquityTrade):
            print(f"{m.symbol}: ${m.price} × {m.size}")

# Reads MASSIVE_API_KEY from environment
ws = WebSocketClient(
    subscriptions=["T.AAPL", "T.MSFT"],  # "T.*" subscribes to all trades
)
ws.run(handle_msg=handle_msg)
```

**Subscription channels**:
- `T.<TICKER>` — real-time trades for a symbol (`T.*` for all)
- `Q.<TICKER>` — real-time NBBO quotes
- `AM.<TICKER>` — per-minute aggregate bars
- `A.<TICKER>` — per-second aggregate bars

---

## How FinAlly Uses the API

The `MassiveDataSource` runs a background polling loop:

```python
import asyncio
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from .cache import PriceCache

class MassiveDataSource:
    def __init__(self, api_key: str, price_cache: PriceCache, poll_interval: float = 15.0):
        self._client = RESTClient(api_key=api_key)
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []

    async def _poll_once(self) -> None:
        if not self._tickers:
            return
        # RESTClient is synchronous — run in a thread to avoid blocking the event loop
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
                    timestamp=snap.last_trade.timestamp / 1000.0,  # ms → seconds
                )
            except (AttributeError, TypeError):
                pass  # skip malformed snapshots

    async def _poll_loop(self) -> None:
        while True:
            await self._poll_once()
            await asyncio.sleep(self._interval)
```

**Key decisions**:
- `asyncio.to_thread` wraps the synchronous `RESTClient` call so it doesn't block FastAPI's event loop.
- `get_snapshot_all` with `tickers=` makes one API call for all watchlist tickers — stays within the free-tier 5 req/min limit even when polling every 15 seconds.
- Timestamps from the API are Unix milliseconds; we convert to seconds for the `PriceCache`.
- Missing or malformed snapshot fields are skipped silently; the cache retains the last known price.

---

## Error Reference

| HTTP Status | Meaning | Handling |
|-------------|---------|----------|
| 401 | Invalid API key | Log and stop; bad key won't fix itself |
| 403 | Plan doesn't include endpoint | Log and stop |
| 429 | Rate limit exceeded | Log and back off; reduce poll interval |
| 5xx | Server error | Log; retry on next interval (client has 3 built-in retries) |

The polling loop catches all exceptions and logs them without crashing — the cache retains stale prices until the next successful poll.

---

## Debug Mode

```python
client = RESTClient(trace=True, verbose=True)
```

Prints each request URL, response headers, and request IDs — useful for diagnosing 4xx errors.
