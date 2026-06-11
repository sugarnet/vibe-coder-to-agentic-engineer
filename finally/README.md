# FinAlly — AI Trading Workstation

A visually rich, data-dense trading terminal powered by AI. Stream live market prices, trade a simulated portfolio, and let an AI assistant analyze positions and execute trades on your behalf.

Built entirely by AI coding agents as the final project of an agentic programming course.

---

## What It Does

- **Live price stream** — 10 default tickers updating every ~500ms via SSE, with green/red flash animations
- **Sparkline charts** — mini price charts per ticker accumulated from the live stream
- **Trade execution** — buy/sell at market price instantly; no commissions, no confirmation dialogs
- **Portfolio heatmap** — treemap of positions sized by weight, colored by P&L
- **P&L chart** — total portfolio value over time
- **AI chat assistant** — ask about your portfolio, get analysis, and let the AI execute trades via natural language

---

## Quick Start

```bash
# Copy and configure environment variables
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env

# Build and run (macOS/Linux)
./scripts/start_mac.sh

# Open http://localhost:8000
```

Windows:
```powershell
.\scripts\start_windows.ps1
```

To stop:
```bash
./scripts/stop_mac.sh
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI chat |
| `MASSIVE_API_KEY` | No | Polygon.io key for real market data (uses simulator if unset) |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (for testing) |

---

## Architecture

Single Docker container, single port (8000):

```
FastAPI (Python/uv)
├── /api/*           REST endpoints (portfolio, watchlist, chat)
├── /api/stream/*    SSE price streaming
└── /*               Next.js static export (frontend)

SQLite (volume-mounted at /app/db/finally.db)
Background task: market data simulator or Massive API poller
```

**Market data** defaults to a built-in GBM (Geometric Brownian Motion) simulator with correlated sector moves and random shock events. Switch to real Polygon.io data by setting `MASSIVE_API_KEY`.

**AI chat** uses LiteLLM → OpenRouter (Cerebras inference) with structured JSON output. The LLM can execute trades and manage your watchlist automatically.

---

## Development

### Backend (Python/FastAPI/uv)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Run tests:
```bash
uv run pytest
uv run pytest --cov=app
```

Live market data demo (terminal dashboard):
```bash
uv run market_data_demo.py
```

### Frontend (Next.js/TypeScript)

```bash
cd frontend
npm install
npm run dev       # dev server at :3000
npm run build     # static export
```

---

## Project Structure

```
finally/
├── backend/          FastAPI app (uv project)
│   ├── app/
│   │   └── market/   Price simulator, Massive client, SSE stream
│   └── tests/
├── frontend/         Next.js static export
├── scripts/          start/stop Docker wrappers
├── test/             E2E tests (Playwright + docker-compose.test.yml)
├── db/               Volume mount point (finally.db lives here at runtime)
├── planning/         Architecture docs and agent contracts
├── Dockerfile        Multi-stage build (Node → Python)
└── .env.example
```

---

## Default Portfolio

On first run the app seeds:
- **$10,000** virtual cash
- **10 tickers** on the watchlist: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX

Data persists across restarts via Docker volume (`finally-data`).
