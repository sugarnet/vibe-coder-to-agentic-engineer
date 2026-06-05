# FinAlly — Code Review

**Date:** 2026-06-05
**Reviewer:** Claude Sonnet 4.6
**Scope:** Full codebase on branch `main` as of commit `02f6b0c`
**What exists:** `backend/app/market/` (8 modules), `backend/tests/market/` (6 test files), planning docs. Frontend, Docker, scripts, database layer, portfolio API, chat/LLM integration — all absent.

---

## 1. Security

### CRITICAL — Live API keys committed inside `.env`

`/.env` contains two live credentials:

```
OPENROUTER_API_KEY=<redacted>
MASSIVE_API_KEY=<redacted>
```

The file is correctly listed in `.gitignore` and is not currently tracked. However, it exists on disk in plaintext. The repository has no `.env.example` as the plan requires. The risk here is accidental `git add .` in a future commit, or the file being read by any process with filesystem access to this directory.

**Action required:**
- Rotate both keys immediately.
- Add `.env.example` with placeholder values (plan section 5 requires this).
- Confirm `.env` is never staged: `git status` must always show it as untracked.

---

## 2. Correctness Bugs

### HIGH — Module-level router created once; `create_stream_router` registers a route on it on every call

`backend/app/market/stream.py` lines 17 and 20–28:

```python
router = APIRouter(prefix="/api/stream", tags=["streaming"])

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        ...
    return router
```

`router` is a module-level singleton. Every call to `create_stream_router()` registers a new `GET /prices` route on the same router object. In production this is called once, so there is no visible bug. In tests, any test that imports and calls `create_stream_router()` twice (e.g., across test modules) will double-register the route, causing routing ambiguity. FastAPI will silently use the first registered handler.

**Fix:** Move `router = APIRouter(...)` inside `create_stream_router()` so each call produces a fresh router.

### MEDIUM — `PriceCache.version` property read outside lock

`backend/app/market/cache.py` lines 64–66:

```python
@property
def version(self) -> int:
    return self._version
```

All other read/write operations on `_prices` and `_version` in this class acquire `self._lock`. `version` does not. On CPython with the GIL, reading a Python `int` is atomic, but the design intent of the class is to always hold the lock when accessing shared state. This is inconsistent and becomes a data race on any GIL-free Python build (Python 3.13t / PEP 703). The SSE generator polls `cache.version` in a tight loop every 500ms, making this the hottest read path in the application.

**Fix:** Acquire `self._lock` in the `version` property.

### LOW — `SimulatorDataSource.get_tickers()` returns state from an unstarted source without error

`backend/app/market/simulator.py` lines 257–258:

```python
def get_tickers(self) -> list[str]:
    return self._sim.get_tickers() if self._sim else []
```

Calling `get_tickers()` before `start()` silently returns `[]`. The `MarketDataSource` interface documents that `start()` must be called before other methods, but there is no guard or assertion. A caller who forgets `await source.start(tickers)` gets empty results with no diagnostic. Not a runtime crash, but a silent failure mode that would be hard to debug. The same pattern applies to `add_ticker()` and `remove_ticker()` (both guard on `if self._sim`).

---

## 3. Architecture and Plan Adherence

### MAJOR GAP — Only the market data subsystem exists

The plan defines 8 API endpoint groups and a complete full-stack application. As of this commit, only `backend/app/market/` is implemented. The following components required by the plan are entirely absent:

| Plan Section | Component | Status |
|---|---|---|
| Section 7 | SQLite database + schema + seed data | Missing |
| Section 8 | Portfolio API (`/api/portfolio`, `/api/portfolio/trade`, `/api/portfolio/history`) | Missing |
| Section 8 | Watchlist API (`/api/watchlist`) | Missing |
| Section 8 | Chat API (`/api/chat`) | Missing |
| Section 8 | Health check (`/api/health`) | Missing |
| Section 9 | LLM integration (LiteLLM → OpenRouter/Cerebras) | Missing |
| Section 10 | Next.js frontend (all of it) | Missing |
| Section 11 | Dockerfile multi-stage build | Missing |
| Section 11 | `scripts/start_mac.sh`, `stop_mac.sh`, PowerShell equivalents | Missing |
| Section 12 | E2E tests with Playwright | Missing |
| Section 5 | `.env.example` | Missing |
| Root | `db/` directory with `.gitkeep` | Missing |
| Root | `docker-compose.yml` | Missing |
| Root | `test/docker-compose.test.yml` | Missing |

This is not a critique of work quality — the market data module that does exist is well-built. It is a statement of overall project completion: the codebase is approximately 15% of what the plan describes.

### MEDIUM — No FastAPI application entry point

There is no `main.py` or `app.py` at the backend root that wires up FastAPI, mounts the stream router, and starts the background data source task. The `create_stream_router()` and `create_market_data_source()` factories exist, but nothing calls them. There is also no lifecycle handler (startup/shutdown) to call `await source.start(tickers)` and `await source.stop()`.

When an agent implements the main FastAPI app, the startup sequence must:
1. Create `PriceCache`
2. Call `create_market_data_source(cache)` → `await source.start(default_tickers)`
3. Mount `create_stream_router(cache)` — calling it only once (see bug in section 2)
4. Register a shutdown handler: `await source.stop()`

### LOW — Plan inconsistency: model ID for LLM

Plan section 9 specifies `openrouter/openai/gpt-oss-120b` but also says "the skill must be considered canonical." The cerebras skill in `.claude/skills/cerebras/SKILL.md` defines a different model ID. Any agent implementing the LLM integration will see a conflict. The canonical model ID from the skill should be recorded explicitly in the plan to prevent divergence.

---

## 4. Code Quality

### The market data module is well-written

Positive observations, recorded so downstream agents know what patterns to follow:

- `PriceUpdate` is a frozen dataclass with `slots=True` — correct and efficient for an object created thousands of times per minute.
- `GBMSimulator.step()` uses numpy vectorized normal draws and Cholesky correlation — mathematically correct and performant.
- Both `_run_loop` (simulator) and `_poll_loop`/`_poll_once` (Massive) catch all exceptions and continue — essential for long-running background tasks.
- `SimulatorDataSource.stop()` properly cancels the asyncio task and awaits `CancelledError` — the correct asyncio cancellation pattern.
- The factory reads from the environment at call time, not at module import time — testable without environment mutation at import.
- `PriceCache.get_all()` returns a shallow copy — prevents callers from mutating internal state.

### TRIVIAL — `_add_ticker_internal` has a redundant guard

`backend/app/market/simulator.py` lines 147–151:

```python
def _add_ticker_internal(self, ticker: str) -> None:
    if ticker in self._prices:
        return
    ...
```

`add_ticker()` (the public method, line 121) already checks `if ticker in self._prices: return` before calling `_add_ticker_internal`. The guard inside `_add_ticker_internal` is redundant for the call from `add_ticker`, but it is needed for correctness when called directly from `__init__`. The duplication is harmless but slightly confusing. Leave it as-is or add a comment explaining why both guards exist.

---

## 5. Test Suite

### Coverage gaps relative to plan requirements

The plan (section 12) specifies tests for:
- Portfolio execution logic, P&L calculations, edge cases — no tests exist (no code exists yet)
- LLM structured output parsing — no tests exist (no code exists yet)
- API route status codes and response shapes — no tests exist (no routes exist yet)
- Frontend component tests — no tests exist (no frontend exists yet)

For the market data module specifically (the only implemented component), coverage is 84% overall with two gaps:

1. `stream.py` at 31%: No test exercises the SSE `_generate_events` generator. The plan calls the SSE stream the primary real-time data path. At minimum, a test using `httpx.AsyncClient` with an ASGI app should verify: (a) the `retry:` header is sent, (b) a price update produces a `data:` event, (c) the generator exits cleanly when the client disconnects.

2. `massive_client.py` at 56%: Five tests in `test_massive.py` rely on the `massive` package being installed. The MARKET_DATA_REVIEW.md documents that these tests fail in environments without `massive`. Since `massive` is a declared dependency in `pyproject.toml`, they should pass after `uv sync`, but CI environments or fresh clones that only install dev dependencies may fail. The fix is to either ensure `massive` is always installed in test environments, or add `create=True` to the `patch("app.market.massive_client.RESTClient")` calls in the two affected tests.

### No SSE integration test

There is no test for the full SSE pipeline: `SimulatorDataSource` → `PriceCache` → `_generate_events`. This is the critical path for the frontend. A test should:
- Create a minimal FastAPI app, mount the stream router
- Use `httpx.AsyncClient` in SSE mode
- Start the simulator, assert at least one `data:` event arrives within 2 seconds

---

## 6. Dependency and Build Configuration

### pyproject.toml: missing dependencies for the full app

`backend/pyproject.toml` currently declares dependencies for the market data module only. When the remaining components are implemented, the following will be needed and should be added then:

- `python-dotenv` or equivalent — to load `.env` (the plan says the backend reads `.env` from the project root)
- `litellm` — for LLM integration (plan section 9)
- `aiosqlite` or `aiofiles` — for async SQLite access (or synchronous `sqlite3` is acceptable given the single-user constraint)

The plan does not specify a `.env` loading mechanism. Given the Docker deployment model (`--env-file .env`), environment variables will be injected by Docker and `python-dotenv` may not be needed in production. However, for local development outside Docker, explicit loading will be necessary. This should be clarified before the database and LLM agents begin work.

### `rich` is a production dependency

`backend/pyproject.toml` lists `rich>=13.0.0` in `[project.dependencies]` (not in `[project.optional-dependencies]`). `rich` is only used in `market_data_demo.py`, a demo script that is not part of the production app. It should move to `[project.optional-dependencies]` under a `demo` extra, or `market_data_demo.py` should be relocated outside the installable package.

---

## 7. Summary Table

| ID | Severity | Area | Finding |
|---|---|---|---|
| S1 | CRITICAL | Security | Live API keys in `.env` on disk; `.env.example` missing |
| B1 | HIGH | Correctness | Module-level SSE router — double-registration risk in tests |
| B2 | MEDIUM | Correctness | `PriceCache.version` read without lock |
| B3 | LOW | Correctness | `get_tickers()` / `add_ticker()` / `remove_ticker()` silently no-op before `start()` |
| A1 | MAJOR | Architecture | 85% of planned components not yet implemented |
| A2 | MEDIUM | Architecture | No FastAPI app entry point; no startup/shutdown lifecycle |
| A3 | LOW | Architecture | LLM model ID inconsistency between plan section 9 and cerebras skill |
| Q1 | TRIVIAL | Quality | `rich` in production dependencies; belongs in optional or dev |
| T1 | MEDIUM | Testing | No SSE integration test for the primary data path |
| T2 | LOW | Testing | 5 Massive tests may fail without `massive` package installed |
