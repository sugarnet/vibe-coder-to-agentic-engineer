# Massive API (formerly Polygon.io) — Stock Market Data

Polygon.io rebranded as **Massive** on October 30, 2025. All existing API keys and integrations continue to work unchanged. The REST base URL moved from `api.polygon.io` to `api.massive.com`; both are supported.

---

## Authentication

Pass your API key as a query parameter or Authorization header on every request.

```
# Query parameter (simplest)
GET https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=YOUR_KEY

# Authorization header (preferred for production)
Authorization: Bearer YOUR_KEY
```

The API key is available from the [Massive dashboard](https://massive.com/dashboard).

---

## Rate Limits

| Plan | Calls / min | Data recency |
|------|-------------|--------------|
| Free (Basic) | 5 | End-of-day only |
| Starter (paid) | Unlimited | 15-min delayed |
| Developer (paid) | Unlimited | Real-time |
| Advanced / Business | Unlimited | Real-time |

For the free tier, polling every 15 seconds uses at most 4 calls/min — safely within the limit.

---

## Python Client

The official Python client handles authentication, pagination, and retries automatically.

```bash
pip install -U massive
# Legacy name still works: pip install -U polygon-api-client
```

```python
from massive import RESTClient

client = RESTClient(api_key="YOUR_KEY")
# Optionally enable debug logging:
# client = RESTClient(api_key="YOUR_KEY", trace=True, verbose=True)
```

---

## Key Endpoints

### 1. Full Market Snapshot — multiple tickers in one call

The most efficient endpoint for polling a watchlist. Returns consolidated real-time data (last trade, last quote, day bar, previous day bar) for each requested ticker.

```
GET /v2/snapshot/locale/us/markets/stocks/tickers
```

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tickers` | string | No | Comma-separated ticker symbols, e.g. `AAPL,GOOGL,MSFT`. Omit for all tickers. |
| `include_otc` | boolean | No | Include OTC securities (default: `false`) |
| `apiKey` | string | Yes* | API key (if not using Authorization header) |

**Example request**

```python
from massive import RESTClient

client = RESTClient(api_key="YOUR_KEY")

# Fetch snapshot for multiple tickers at once
response = client.get_snapshot_all(
    "stocks",
    tickers=["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]
)

for ticker_snap in response:
    print(
        ticker_snap.ticker,
        ticker_snap.last_trade.price if ticker_snap.last_trade else None,
        ticker_snap.todays_change_perc,
    )
```

**Example raw HTTP request**

```
GET https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,GOOGL,MSFT&apiKey=YOUR_KEY
```

**Response schema**

```json
{
  "status": "OK",
  "count": 3,
  "tickers": [
    {
      "ticker": "AAPL",
      "todaysChange": 2.45,
      "todaysChangePerc": 1.28,
      "updated": 1717689600000000000,
      "day": {
        "o": 189.50,
        "h": 192.30,
        "l": 188.90,
        "c": 191.95,
        "v": 54321000,
        "vw": 191.02
      },
      "lastTrade": {
        "p": 191.95,
        "s": 100,
        "t": 1717689600000000000,
        "x": 4
      },
      "lastQuote": {
        "P": 192.00,
        "S": 3,
        "p": 191.90,
        "s": 2,
        "t": 1717689600000000000
      },
      "min": {
        "o": 191.80,
        "h": 192.10,
        "l": 191.75,
        "c": 191.95,
        "v": 12300,
        "vw": 191.88,
        "t": 1717689540000
      },
      "prevDay": {
        "o": 188.50,
        "h": 190.20,
        "l": 188.00,
        "c": 189.50,
        "v": 61200000,
        "vw": 189.12
      }
    }
  ]
}
```

**Response field reference**

| Field | Description |
|-------|-------------|
| `ticker` | Ticker symbol |
| `todaysChange` | Absolute price change from previous close |
| `todaysChangePerc` | Percentage change from previous close |
| `updated` | Nanosecond Unix timestamp of last update |
| `day.o/h/l/c` | Today's open / high / low / close |
| `day.v` | Today's volume |
| `day.vw` | Today's volume-weighted average price |
| `lastTrade.p` | Last trade price |
| `lastTrade.s` | Last trade size (shares) |
| `lastTrade.t` | Last trade timestamp (nanoseconds) |
| `lastQuote.P` | Best ask price |
| `lastQuote.p` | Best bid price |
| `min.c` | Close of the most recent minute bar |
| `prevDay.o/h/l/c` | Previous day OHLC |

---

### 2. Single Ticker Snapshot

```
GET /v2/snapshot/locale/us/markets/stocks/tickers/{stocksTicker}
```

Same response structure as the full snapshot but for one ticker.

```python
snap = client.get_snapshot("stocks", "AAPL")
price = snap.last_trade.price
change_pct = snap.todays_change_perc
```

---

### 3. Previous Day Bar (OHLC)

End-of-day close for the most recent completed trading session.

```
GET /v2/aggs/ticker/{stocksTicker}/prev
```

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `adjusted` | boolean | `true` | Adjust for stock splits |

```python
prev = client.get_previous_close_agg("AAPL")
# prev.results[0] contains o, h, l, c, v, vw, t
print(prev.results[0].c)  # close price
```

**Response schema**

```json
{
  "ticker": "AAPL",
  "adjusted": true,
  "queryCount": 1,
  "resultsCount": 1,
  "status": "OK",
  "results": [
    {
      "o": 188.50,
      "h": 190.20,
      "l": 188.00,
      "c": 189.50,
      "v": 61200000,
      "vw": 189.12,
      "t": 1717603200000,
      "n": 412500
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `o` | Open price |
| `h` | High price |
| `l` | Low price |
| `c` | Close price |
| `v` | Volume |
| `vw` | Volume-weighted average price |
| `t` | Bar start time (Unix milliseconds) |
| `n` | Number of transactions |

---

### 4. Custom Bars (OHLC over a date range)

Aggregate bars over any time window. Useful for populating charts.

```
GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `multiplier` | integer | Timespan multiplier (e.g., `1` for 1-minute bars) |
| `timespan` | string | `minute`, `hour`, `day`, `week`, `month`, `quarter`, `year` |
| `from` | string | Start date `YYYY-MM-DD` or millisecond Unix timestamp |
| `to` | string | End date `YYYY-MM-DD` or millisecond Unix timestamp |
| `adjusted` | boolean | Adjust for splits (default: `true`) |
| `sort` | string | `asc` or `desc` (default: `asc`) |
| `limit` | integer | Max results (default: 5000, max: 50000) |

```python
# Last 7 days of daily bars for AAPL
aggs = []
for bar in client.list_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",
    from_="2026-06-11",
    to="2026-06-18",
    adjusted=True,
    sort="asc",
    limit=50000,
):
    aggs.append(bar)
# bar.o, bar.h, bar.l, bar.c, bar.v, bar.vw, bar.t
```

**Response schema** (same bar fields as Previous Day Bar above, in a `results` array.)

---

### 5. Daily Open/Close (specific date)

```
GET /v1/open-close/{stocksTicker}/{date}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | `YYYY-MM-DD` format |
| `adjusted` | boolean | Adjust for splits (default: `true`) |

```python
# Raw HTTP — no dedicated client method
import httpx
resp = httpx.get(
    "https://api.massive.com/v1/open-close/AAPL/2026-06-17",
    params={"adjusted": "true", "apiKey": "YOUR_KEY"}
)
data = resp.json()
# data: { open, close, high, low, volume, afterHours, preMarket, symbol, from }
```

---

### 6. Last Trade (single ticker)

```
GET /v2/last/trade/{stocksTicker}
```

```python
trade = client.get_last_trade("AAPL")
# trade.price, trade.size, trade.timestamp
```

**Example response**

```json
{
  "status": "OK",
  "results": {
    "T": "AAPL",
    "p": 191.95,
    "s": 25,
    "t": 1717689600000000000,
    "x": 4
  }
}
```

| Field | Description |
|-------|-------------|
| `T` | Ticker symbol |
| `p` | Trade price |
| `s` | Trade size |
| `t` | Timestamp (nanoseconds) |
| `x` | Exchange ID |

---

## Recommended Polling Pattern for FinAlly

Given the free tier limit of 5 calls/min, the optimal approach is:

1. **One call per poll cycle** using the Full Market Snapshot endpoint with all watchlist tickers as a comma-separated `tickers` parameter.
2. **Poll interval**: 15 seconds on free tier (4 calls/min), 2 seconds on paid tiers.
3. **Single background task** writes results to an in-memory price cache; SSE streams read from the cache.

```python
import httpx
import asyncio
from typing import Sequence

BASE_URL = "https://api.massive.com"

async def fetch_snapshots(api_key: str, tickers: Sequence[str]) -> list[dict]:
    """Fetch latest price snapshot for all tickers in one API call."""
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    params = {
        "tickers": ",".join(tickers),
        "apiKey": api_key,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    return data.get("tickers", [])
```

---

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | OK | Parse response |
| 403 | Invalid or missing API key | Log error, stop polling |
| 429 | Rate limit exceeded | Back off, retry after 60s |
| 404 | Ticker not found | Skip ticker, log warning |
| 5xx | Server error | Retry with exponential backoff |

All error responses include a `status` field (e.g., `"ERROR"`) and a `message` field describing the issue.

```python
data = resp.json()
if data.get("status") == "ERROR":
    raise ValueError(f"Massive API error: {data.get('message')}")
```
