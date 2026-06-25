# Market Data Backend — Code Review

**Reviewer:** Claude (Sonnet 4.6)
**Date:** 2026-06-18
**Scope:** `finally/backend/app/market/` and `finally/backend/tests/market/`
**Planning docs reviewed:** PLAN.md, MARKET_DATA_DESIGN.md, MARKET_INTERFACE.md, MARKET_SIMULATOR.md, MASSIVE_API.md

---

## Summary

The Market Data backend is a well-structured, production-quality implementation. The code closely follows the `MARKET_DATA_DESIGN.md` specification, with clean separation of concerns across modules. Test coverage is broad and the design patterns are sound.

**Overall verdict: APPROVED with minor issues**

One substantive bug was found (timestamp conversion), several minor documentation inaccuracies, and a handful of low-risk code quality observations.

---

## Test Execution

Tests could not be executed in this environment because `python3`, `pip`, and `pytest` require additional `--allowedTools` permissions that were not granted. The review below is based on complete static analysis of all source files and tests.

The test suite comprises **87 test cases** across 7 test files:

| File | Test class | Tests |
|------|-----------|-------|
| `test_models.py` | `TestPriceUpdate` | 9 |
| `test_cache.py` | `TestPriceCache` | 12 |
| `test_simulator.py` | `TestGBMSimulator` | 18 |
| `test_simulator_source.py` | `TestSimulatorDataSource` | 9 |
| `test_massive.py` | `TestMassiveDataSource` | 14 |
| `test_factory.py` | `TestFactory` | 7 |
| `test_stream.py` | `TestCreateStreamRouter` + `TestGenerateEvents` | 18 |

Based on analysis, all tests appear structurally correct and should pass with one exception noted below.

---

## Module-by-Module Review

### `models.py` — PriceUpdate

**Grade: A**

`PriceUpdate` is correctly implemented as a frozen dataclass with `slots=True`, making it both immutable and memory-efficient. The computed properties (`change`, `change_percent`, `direction`) are clean and well-rounded. `to_dict()` provides the canonical JSON shape used throughout the system.

**Observations:**

- The `timestamp` field uses `time.time()` as its default factory (Unix seconds). This is consistent with design doc intent.
- Rounding to 4dp in computed properties is correct and matches the design specification.
- `previous_price == 0` guard in `change_percent` prevents `ZeroDivisionError` correctly.

No issues.

---

### `cache.py` — PriceCache

**Grade: A**

Thread-safe with `threading.Lock`. Correct choice given that `MassiveDataSource` calls the Massive SDK synchronously inside `asyncio.to_thread`, which runs on a thread pool. An `asyncio.Lock` would deadlock in this scenario.

The `version` counter is an elegant mechanism for SSE change detection — the stream generator only sends events when the version changes, avoiding redundant no-op events.

**Observations:**

- **Minor:** `version` property reads `self._version` without the lock:
  ```python
  @property
  def version(self) -> int:
      return self._version
  ```
  In CPython, integer reads are atomic due to the GIL, so this is safe in practice. However, conceptually this is inconsistent with the rest of the class, which always acquires `self._lock` before reading shared state. Low-risk but worth noting.

- Price is rounded to 2 decimal places in `update()`. This is intentional per the design doc ("stored rounded to 2 decimal places by the cache (cents)").

---

### `interface.py` — MarketDataSource ABC

**Grade: A+**

Clean abstract interface with 5 methods: `start`, `stop`, `add_ticker`, `remove_ticker`, `get_tickers`. Well-documented lifecycle contract in the docstring. Both implementations satisfy this contract correctly.

No issues.

---

### `factory.py` — create_market_data_source

**Grade: A**

Lazy imports are a good pattern here — the `massive` package is only loaded when actually needed. Whitespace stripping on the API key (`strip()`) correctly handles the case where the env var is set to spaces.

No issues.

---

### `seed_prices.py`

**Grade: A-**

Seed prices, per-ticker GBM parameters, and correlation groups are all clearly defined and sensible.

**Observations:**

- **Minor documentation inaccuracy:** TSLA is absent from `CORRELATION_GROUPS["tech"]`, which is correct (it gets `TSLA_CORR = 0.3` regardless). However, the comment in `simulator.py:188` says `# TSLA is in tech set but behaves independently`. The comment is misleading — TSLA is NOT in the tech set, it is simply special-cased to always return `TSLA_CORR`. The comment should say "TSLA has its own correlation regardless of sector."

- NFLX is in `CORRELATION_GROUPS["tech"]` but has its own ticker params. This is acceptable (streaming is tech-adjacent).

---

### `simulator.py` — GBMSimulator + SimulatorDataSource

**Grade: A**

The GBM implementation is mathematically sound. Using Cholesky decomposition on a full correlation matrix is more rigorous than the two-factor model described in `MARKET_SIMULATOR.md` (the design was evolved during implementation — see discrepancies section below).

**Observations:**

- The `step()` method is the hot path (called every 500ms). It efficiently uses the cached `_cholesky` matrix and only rebuilds on structural changes (add/remove ticker).

- `_rebuild_cholesky()` is called on every `add_ticker` and `remove_ticker`. For `n < 50` tickers, `O(n²)` is fine.

- **Minor:** After `stop()`, `self._sim` is not set to `None` (only `self._task`). This means `add_ticker()` and `remove_ticker()` will still modify `_sim` after the source is stopped. Changes accumulate silently but are harmless since no loop is running. This edge case is unlikely to matter in practice (restart would call `start()` with a fresh ticker list from the DB), but it's worth documenting.

- `_add_ticker_internal()` uses `random.uniform(50.0, 300.0)` for unknown ticker seed prices. This is per spec. No `seed` value is persisted for unknown tickers, which means the ceiling check in `MARKET_SIMULATOR.md` (`max(1.0, min(new_price, seed * 10))`) is not implemented. However, the design doc for the actual implementation (`MARKET_DATA_DESIGN.md`) does not mention a price ceiling, so this is correct.

- `GBMSimulator` is correctly a pure-Python math class with no I/O, making it straightforwardly unit-testable.

---

### `massive_client.py` — MassiveDataSource

**Grade: B+**

Solid implementation with correct use of `asyncio.to_thread` for the synchronous SDK call. Error handling is appropriate — errors are logged but not re-raised, preventing loop crash on transient network failures.

**Issues:**

- **Bug: Timestamp conversion is incorrect.**

  In `_poll_once()`:
  ```python
  # Massive timestamps are Unix milliseconds → convert to seconds
  timestamp = snap.last_trade.timestamp / 1000.0
  ```
  The comment says "milliseconds", but according to `MASSIVE_API.md`, `lastTrade.t` contains a **nanosecond** Unix timestamp:
  ```
  "lastTrade": { "p": 191.95, "s": 100, "t": 1717689600000000000, "x": 4 }
  ```
  The value `1717689600000000000` is 19 digits — that is nanoseconds (Unix epoch in ns). Dividing by `1000` converts ns → µs, not ns → seconds. The correct divisor is `1_000_000_000` (or `1e9`).

  The design doc (`MARKET_DATA_DESIGN.md`) itself says `lastTrade.t / 1000` converts "nanoseconds → seconds", which is mathematically incorrect — dividing ns by 1000 yields microseconds.

  The test `test_timestamp_conversion` in `test_massive.py` passes a **millisecond**-scale mock value (`1707580800000`, 13 digits) and divides by 1000 to get `1707580800.0`. This happens to produce a valid Unix timestamp in seconds, but only because the test uses millisecond-scale input, not nanosecond-scale input as the real API sends. The test would pass but does not validate the correct behavior against the real API.

  **Fix:** Change `/ 1000.0` to `/ 1_000_000_000` and update the comment. The test mock values should also be updated to use nanosecond-scale timestamps.

- **Minor:** `MassiveDataSource.add_ticker()` does not immediately seed the cache (unlike `SimulatorDataSource.add_ticker()` which seeds immediately). The design doc documents this difference, but callers should be aware that a newly added ticker may have `None` price in the cache for up to `poll_interval` seconds (default: 15s). This could cause a `None` to be returned at `GET /api/watchlist` immediately after adding a ticker.

---

### `stream.py` — SSE Streaming

**Grade: A**

Clean SSE implementation using the `version` counter to avoid sending duplicate events. The `retry: 1000\n\n` directive correctly instructs the client's `EventSource` to reconnect after 1 second on disconnect.

**Observations:**

- `asyncio.CancelledError` is caught at the generator level, allowing for clean shutdown. This is correct for Python 3.8+ where `CancelledError` is a subclass of `BaseException`.

- `create_stream_router()` uses a closure over `price_cache`. Each call creates a new `APIRouter` with a fresh route registration — this avoids duplicate route accumulation on repeated calls (e.g., in tests), as confirmed by `test_no_duplicate_routes_on_multiple_calls`.

- The `Connection: keep-alive` header is vestigial in HTTP/2 (connections are always persistent) but harmless and correct for HTTP/1.1.

- Version comparison uses `!=` instead of `>`. Since version is monotonically increasing, both are functionally equivalent. `>` would be slightly more semantically correct but this is a non-issue.

---

### `market_data_demo.py`

**Grade: A**

A well-constructed terminal demo using Rich. Clean separation from the production module — the demo only uses the public API (`PriceCache`, `SimulatorDataSource`). The sparkline renderer is a nice touch.

The `print_summary()` function correctly uses `SEED_PRICES` for session comparison.

No issues.

---

## Test Suite Analysis

### Coverage Assessment

| Component | Test file | Coverage quality |
|-----------|-----------|-----------------|
| `PriceUpdate` | `test_models.py` | Excellent — all properties, edge cases |
| `PriceCache` | `test_cache.py` | Excellent — full CRUD, version, type checks |
| `GBMSimulator` | `test_simulator.py` | Very good — math properties, correlation |
| `SimulatorDataSource` | `test_simulator_source.py` | Good — async lifecycle, edge cases |
| `MassiveDataSource` | `test_massive.py` | Good — mocked API, error paths |
| `create_market_data_source` | `test_factory.py` | Good — all env var branches |
| SSE stream | `test_stream.py` | Excellent — event shape, disconnect, version |

### Test Quality Issues

1. **`test_simulator_source.py::test_exception_resilience`** — This test verifies that the background task is still running after some time, but it does not actually inject an exception into the loop. The test is named "exception_resilience" but only tests normal operation. A proper test would monkeypatch `self._sim.step()` to raise an exception on one call and verify the loop continues. The current test is not wrong but is misleadingly named.

2. **`conftest.py` dead code** — The `event_loop_policy` fixture returns a policy object but does nothing with it. pytest-asyncio does not automatically apply a returned policy; it would need to use `asyncio.set_event_loop_policy()`. This fixture is effectively unused dead code.

3. **`test_massive.py::test_timestamp_conversion`** — As noted above, uses millisecond-scale mock data (`1707580800000`) but the real API returns nanoseconds. The test passes but validates the wrong behavior.

4. **`test_simulator.py::test_prices_rounded_to_two_decimals`** — The assertion checks `len(decimal_part) <= 2`. This will pass even for `str(190.0)` → `'0'` (1 char). While this is technically correct (0 decimals is ≤ 2), the test intent is to verify 2-decimal rounding, which isn't fully validated here. The test could be strengthened with a regex like `r'^\d+\.\d{1,2}$'`.

---

## Design Document vs. Implementation Discrepancies

### Resolved discrepancies (implementation is correct)

1. **Module path** — `MARKET_INTERFACE.md` describes `backend/market/` while `MARKET_DATA_DESIGN.md` and the implementation use `backend/app/market/`. The implementation follows `MARKET_DATA_DESIGN.md` (the more recent, authoritative spec).

2. **Field naming** — `MARKET_INTERFACE.md` uses `prev_price`/`change_pct` while the implementation uses `previous_price`/`change_percent`. Implementation follows `MARKET_DATA_DESIGN.md`.

3. **PriceCache lock type** — `MARKET_INTERFACE.md` uses `asyncio.Lock` while the implementation uses `threading.Lock`. Implementation is correct (needed for `asyncio.to_thread`).

4. **SSE event field names** — `MARKET_INTERFACE.md` uses `prev_price`/`change_pct` in its event shape. The actual implementation uses `previous_price`/`change_percent`. The `MARKET_DATA_DESIGN.md` spec and the TypeScript interface it provides match the implementation.

### Unresolved discrepancies

1. **Simulator correlation model** — `MARKET_SIMULATOR.md` describes a two-factor market/sector model; the implementation uses Cholesky decomposition on a full correlation matrix. Both achieve correlated moves; the Cholesky approach is more general. `MARKET_SIMULATOR.md` should be updated to reflect the actual implementation.

2. **Jump probability** — `MARKET_SIMULATOR.md` specifies `JUMP_PROBABILITY = 0.002`; the actual default in `SimulatorDataSource` is `event_probability=0.001`. Minor discrepancy.

3. **Jump magnitude** — `MARKET_SIMULATOR.md` specifies up to 6% jumps; the implementation uses `random.uniform(0.02, 0.05)` (max 5%). Minor discrepancy.

---

## Issues Summary

| Severity | Location | Issue |
|----------|----------|-------|
| **Bug** | `massive_client.py:103` | Timestamp divided by 1000 instead of 1e9 — milliseconds vs nanoseconds |
| **Minor** | `massive_client.py:103` | Comment says "milliseconds" but API returns nanoseconds |
| **Minor** | `simulator.py:188` | Comment "TSLA is in tech set" is inaccurate |
| **Minor** | `conftest.py` | `event_loop_policy` fixture is dead code |
| **Minor** | `test_massive.py:97` | Timestamp mock uses ms-scale, not ns-scale |
| **Minor** | `test_simulator_source.py:97` | `test_exception_resilience` doesn't inject exceptions |
| **Info** | `cache.py:65` | `version` property reads without lock (safe in CPython but inconsistent) |
| **Info** | `simulator.py:232` | `stop()` doesn't reset `_sim` to `None` |
| **Info** | `MARKET_INTERFACE.md` | Stale planning doc; inconsistent with final implementation |
| **Info** | `MARKET_SIMULATOR.md` | Correlation model and jump parameters differ from implementation |

---

## Recommendations

1. **Fix the timestamp bug** in `massive_client.py`: change `/ 1000.0` to `/ 1_000_000_000` and update the comment and the `test_timestamp_conversion` mock.

2. **Fix the comment** in `simulator.py:188`: change "TSLA is in tech set" to "TSLA gets fixed low correlation regardless of sector."

3. **Remove the dead fixture** in `conftest.py` or implement it properly with `asyncio.set_event_loop_policy()`.

4. **Improve `test_exception_resilience`** to actually inject an exception into `_sim.step()` to validate the `except Exception` handler in `_run_loop`.

5. **Update `MARKET_SIMULATOR.md`** to reflect the Cholesky-based correlation model actually used.

6. **Consider adding a price** to the cache immediately when `MassiveDataSource.add_ticker()` is called (e.g., by triggering a single immediate poll for just that ticker), to match the behavior of `SimulatorDataSource.add_ticker()`.

---

## Strengths

- Clean layered architecture (GBMSimulator pure math / SimulatorDataSource async wrapper / PriceCache I/O boundary)
- Correct use of `threading.Lock` for the hybrid sync/async access pattern
- Comprehensive test suite covering normal paths, edge cases, and error paths
- Factory pattern with lazy imports cleanly separates configuration from instantiation
- Version-based SSE deduplication is efficient and correct
- Well-documented public API in `__init__.py`
- Demo script (`market_data_demo.py`) is a valuable manual verification tool
- `from __future__ import annotations` used consistently for forward reference support

---

*This review was generated by comprehensive static analysis of all source and test files. Test execution was not possible in this environment (requires additional tool permissions). All findings are based on reading source code, tests, and design documents.*
