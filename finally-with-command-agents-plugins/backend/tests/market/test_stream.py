"""Tests for the SSE streaming router."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import APIRouter

from app.market.cache import PriceCache
from app.market.stream import _generate_events, create_stream_router


class TestCreateStreamRouter:
    """Tests for the create_stream_router factory."""

    def test_returns_api_router(self):
        """Factory should return a FastAPI APIRouter."""
        cache = PriceCache()
        router = create_stream_router(cache)
        assert isinstance(router, APIRouter)

    def test_has_prices_route(self):
        """Router should expose a /prices route."""
        cache = PriceCache()
        router = create_stream_router(cache)
        paths = [route.path for route in router.routes]
        assert "/prices" in paths

    def test_each_call_returns_independent_router(self):
        """Calling the factory twice must not share the same router object."""
        cache = PriceCache()
        r1 = create_stream_router(cache)
        r2 = create_stream_router(cache)
        assert r1 is not r2

    def test_no_duplicate_routes_on_multiple_calls(self):
        """Each router returned should have exactly one route registered."""
        cache = PriceCache()
        r1 = create_stream_router(cache)
        r2 = create_stream_router(cache)
        assert len(r1.routes) == 1
        assert len(r2.routes) == 1


def _make_request(*, disconnect_after: int = 1) -> MagicMock:
    """Create a mock FastAPI Request that disconnects after N is_disconnected calls."""
    request = MagicMock()
    request.client = None  # Avoids attribute access for IP logging
    call_count = 0

    async def is_disconnected() -> bool:
        nonlocal call_count
        call_count += 1
        return call_count > disconnect_after

    request.is_disconnected = is_disconnected
    return request


@pytest.mark.asyncio
class TestGenerateEvents:
    """Tests for the _generate_events async generator."""

    async def test_first_yield_is_retry_directive(self):
        """Generator must emit the SSE retry directive as its very first event."""
        cache = PriceCache()
        request = _make_request(disconnect_after=0)

        events = [e async for e in _generate_events(cache, request, interval=0.01)]
        assert events[0] == "retry: 1000\n\n"

    async def test_stops_on_immediate_disconnect(self):
        """Generator should stop after the retry directive when client is already gone."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        request = _make_request(disconnect_after=0)  # Disconnected from the first check

        events = [e async for e in _generate_events(cache, request, interval=0.01)]
        assert events == ["retry: 1000\n\n"]

    async def test_yields_price_event_when_cache_has_data(self):
        """A data event should be yielded the first time the version changes."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        request = _make_request(disconnect_after=2)  # Allow two loop iterations

        events = [e async for e in _generate_events(cache, request, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) >= 1

        payload = json.loads(data_events[0][len("data: "):].strip())
        assert "AAPL" in payload
        assert payload["AAPL"]["price"] == 190.50
        assert payload["AAPL"]["direction"] == "flat"

    async def test_data_event_contains_all_tickers(self):
        """A single SSE event should include every ticker currently in the cache."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        cache.update("GOOGL", 175.00)
        request = _make_request(disconnect_after=2)

        events = [e async for e in _generate_events(cache, request, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        assert data_events, "Expected at least one data event"

        payload = json.loads(data_events[0][len("data: "):].strip())
        assert "AAPL" in payload
        assert "GOOGL" in payload

    async def test_no_data_event_when_cache_empty(self):
        """If the cache is empty, no data events should be emitted."""
        cache = PriceCache()
        request = _make_request(disconnect_after=3)

        events = [e async for e in _generate_events(cache, request, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        assert data_events == []

    async def test_no_duplicate_events_when_version_unchanged(self):
        """If the cache version does not change, no additional data events are sent."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        # Allow 5 loop iterations — version never changes after the initial update
        request = _make_request(disconnect_after=5)

        events = [e async for e in _generate_events(cache, request, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        # Version changed once (initial update), so exactly 1 data event
        assert len(data_events) == 1

    async def test_new_event_when_version_changes(self):
        """A second data event should be emitted after the cache version increments."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        request_mock = MagicMock()
        request_mock.client = None
        call_count = 0
        price_injected = False

        async def is_disconnected() -> bool:
            nonlocal call_count, price_injected
            call_count += 1
            # After the first data event, inject a new price to bump the version
            if call_count == 2 and not price_injected:
                cache.update("AAPL", 192.00)
                price_injected = True
            return call_count > 4

        request_mock.is_disconnected = is_disconnected

        events = [e async for e in _generate_events(cache, request_mock, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) == 2
        first_price = json.loads(data_events[0][len("data: "):].strip())["AAPL"]["price"]
        second_price = json.loads(data_events[1][len("data: "):].strip())["AAPL"]["price"]
        assert first_price == 190.50
        assert second_price == 192.00

    async def test_event_payload_shape(self):
        """Verify the exact shape of a data event payload."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)  # First update — flat direction
        cache.update("AAPL", 191.00)  # Price goes up
        request = _make_request(disconnect_after=2)

        events = [e async for e in _generate_events(cache, request, interval=0.01)]

        data_events = [e for e in events if e.startswith("data:")]
        assert data_events

        payload = json.loads(data_events[0][len("data: "):].strip())
        aapl = payload["AAPL"]

        assert aapl["ticker"] == "AAPL"
        assert isinstance(aapl["price"], float)
        assert isinstance(aapl["previous_price"], float)
        assert isinstance(aapl["timestamp"], float)
        assert isinstance(aapl["change"], float)
        assert isinstance(aapl["change_percent"], float)
        assert aapl["direction"] in {"up", "down", "flat"}

    async def test_handles_cancelled_error_gracefully(self):
        """Generator should exit cleanly if the task is cancelled."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        request = MagicMock()
        request.client = None
        request.is_disconnected = AsyncMock(return_value=False)

        collected: list[str] = []

        async def consume():
            async for event in _generate_events(cache, request, interval=0.1):
                collected.append(event)

        task = asyncio.create_task(consume())
        await asyncio.sleep(0.05)  # Let it run briefly
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        # Should have collected at least the retry directive
        assert collected[0] == "retry: 1000\n\n"
