# FinAlly — AI Trading Workstation

An AI-powered trading terminal that streams live market data, lets you trade a simulated portfolio, and includes an LLM assistant that can analyze positions and execute trades on your behalf.

Built as the capstone project of an agentic programming course — constructed entirely by AI coding agents.

## What It Does

- **Live price streaming** — prices update every ~500ms via SSE, flashing green/red on change
- **Simulated portfolio** — start with $10,000 virtual cash, buy/sell with instant market orders
- **Sparkline charts** — mini price charts per ticker, built progressively from the live stream
- **Portfolio heatmap** — treemap of positions sized by weight, colored by P&L
- **AI chat assistant** — ask about your portfolio, get analysis, have the AI execute trades
- **Watchlist management** — add/remove tickers manually or via natural language

## Architecture

Single Docker container, single port (8000):

```
FastAPI (Python/uv)
├── /api/*          REST endpoints
├── /api/stream/*   SSE price streaming
└── /*              Next.js static frontend

SQLite (volume-mounted)
Background task: market data (simulator or Polygon.io)
```

## Quick Start

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY at minimum

# Start
./scripts/start_mac.sh

# Open http://localhost:8000
```

```bash
# Stop
./scripts/stop_mac.sh
```

Windows users: use `scripts/start_windows.ps1` / `scripts/stop_windows.ps1`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for the AI chat assistant |
| `MASSIVE_API_KEY` | No | Polygon.io key for real market data (uses simulator if unset) |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (testing) |

## Market Data

By default the app runs a built-in **simulator** using Geometric Brownian Motion — no API key needed. It starts from realistic seed prices, includes correlated sector moves, and fires occasional shock events for visual drama.

Set `MASSIVE_API_KEY` to switch to live Polygon.io data (REST polling, free tier: every 15s).

## Development

**Backend** (Python 3.12, uv):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend** (Next.js, TypeScript):

```bash
cd frontend
npm install
npm run dev
```

**Tests**:

```bash
cd backend
uv run pytest
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12, uv |
| Frontend | Next.js (static export), TypeScript, Tailwind CSS |
| Database | SQLite (single file, volume-mounted) |
| Real-time | Server-Sent Events (SSE) |
| AI | LiteLLM → OpenRouter (Cerebras inference) |
| Deployment | Single Docker container |

## Project Status

| Component | Status |
|---|---|
| Market data (simulator + Polygon.io client + SSE) | Complete |
| Backend API (portfolio, trades, watchlist, chat) | In progress |
| Frontend UI | Planned |
| Docker build + scripts | Planned |
| E2E tests | Planned |
