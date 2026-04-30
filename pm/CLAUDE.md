# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Kanban project management MVP. Single hardcoded user (`user`/`password`), one board per user, with an AI chat sidebar that can create/move/delete cards. Runs in Docker; FastAPI backend serves the Next.js static build at `/`.

## Coding Standards

- No over-engineering, no extra features, no unnecessary defensive programming
- No emojis anywhere in code or output
- Keep it simple; identify root cause before fixing anything

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`

## Commands

### Backend (run from `backend/`)

```bash
# Activate venv first (or use the root-level venv)
source venv/bin/activate

# Run dev server
uvicorn main:app --reload --port 8000

# Run all tests
pytest tests/ -v

# Run a single test file
pytest tests/test_chat.py -v

# Run a single test
pytest tests/test_main.py::TestHealthCheck::test_health_check_returns_200 -v
```

### Frontend (run from `frontend/`)

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Static export to out/
npm run lint         # ESLint
npm run test:unit    # Vitest unit tests
npm run test:unit:watch  # Watch mode
npm run test:e2e     # Playwright e2e tests
npm run test:all     # Unit + e2e
```

### Docker (run from project root)

```bash
./scripts/start.sh   # Build image and start container on port 8000
./scripts/stop.sh    # Stop and remove container

# Manual
docker build -t kanban-api .
docker run -d -p 8000:8000 --name kanban-api --env-file .env kanban-api
docker logs -f kanban-api
```

## Architecture

### Request Flow

```
Browser → FastAPI (port 8000)
  GET /          → serves frontend/out/ (static Next.js export, copied to backend/static/)
  /api/*         → FastAPI route handlers in main.py
```

### Backend (`backend/`)

- `main.py` — all FastAPI routes; token auth via `get_current_user_id` dependency
- `db.py` — SQLAlchemy engine + `get_db` session dependency; SQLite at `backend/kanban.db`
- `app/models.py` — ORM models: `User → Board → Column → Card`, plus `ChatHistory`
- `app/schemas.py` — Pydantic request/response schemas
- `app/crud.py` — all database operations
- `ai.py` — `call_ai(prompt)` async function using OpenAI client pointed at OpenRouter
- `chat.py` — `process_chat_message()`: builds prompt with board state + history, calls AI, parses JSON response `{response, board_updates}`, applies board mutations, saves to `chat_history`

**Auth**: Stateless base64 token encoding `user_id:username:password`. No JWT, no session storage. Token is self-validating on every request.

**AI**: Uses `openai/gpt-oss-120b` via OpenRouter. The AI must return JSON with `response` (text) and optional `board_updates` (array of `create_card`/`move_card`/`delete_card` actions).

### Frontend (`frontend/src/`)

- `app/page.tsx` → renders `KanbanBoard` (if logged in) or `LoginForm`
- `components/KanbanBoard.tsx` — central state manager; orchestrates dnd-kit drag, API calls, and the `AIChatSidebar`
- `lib/api.ts` — all fetch calls to `/api/*`; sets `Authorization: Bearer <token>` header
- `lib/auth.ts` — token storage in `localStorage`
- `lib/useBoard.ts` — custom hook that wraps board state and API sync
- `lib/kanban.ts` — pure logic: `moveCard()`, `findColumnId()`, types

**Next.js config**: Static export mode (`output: 'export'`). The `out/` directory is what gets copied into `backend/static/` during Docker build.

### Environment

`.env` at project root (loaded into Docker container):
```
OPENROUTER_API_KEY=<your key>
```

### Database Schema

`User` (1) → `Board` (1, MVP: one per user) → `Column[]` (fixed 5 columns) → `Card[]`
`Board` also has `ChatHistory[]` (role: `user`|`assistant`)

Columns and cards use integer `position` fields for ordering.
