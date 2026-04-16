# Project Management MVP - Detailed Implementation Plan

## Overview

Build a full-stack Kanban board with AI chat, from frontend demo to containerized production. Target test coverage: **80%** (unit + integration). Language: English for code/docs. Technical decisions in `../AGENTS.md`.

---

## Part 1: Plan & Code Review ✅ CURRENT

**Goal**: Establish detailed roadmap with code analysis and user approval.

### Sub-tasks

- [ ] Review and analyze existing frontend code (`frontend/AGENTS.md`)
- [ ] Document frontend architecture, components, types, and test coverage
- [ ] Enrich this PLAN.md with sub-steps, test specs, and success criteria for all 10 parts
- [ ] Create detailed checklist for each part with clear acceptance criteria
- [ ] Document assumptions (80% test coverage, 1 user, 1 board per user, local SQLite, etc.)

### Tests & Validation

- [ ] Code review: All components use latest React 19 idioms ✓
- [ ] Frontend tests validate 5 columns, drag-drop, CRUD logic ✓
- [ ] No type errors, ESLint passes ✓

### Success Criteria

- [x] `frontend/AGENTS.md` created with architecture overview
- [x] `PLAN.md` enriched with detailed breakdown (this document)
- [ ] User reviews and approves plan (all parts, test strategy, coverage target)

---

## Part 2: Scaffolding - Docker & Backend Setup

**Goal**: Containerized app with working FastAPI backend serving "Hello World" and demo API endpoint.

### Sub-tasks

- [ ] Create `Dockerfile` for Python FastAPI + static site serving
- [ ] Set up `backend/` directory structure:
  - [ ] `main.py` - FastAPI app entry point
  - [ ] `requirements.txt` - Python dependencies (with uv pinning)
  - [ ] `app/` - Application modules (routes, models, etc.)
- [ ] Create start/stop scripts in `scripts/`:
  - [ ] `scripts/start.sh` (Linux/Mac)
  - [ ] `scripts/start.bat` (Windows)
  - [ ] `scripts/stop.sh` (Linux/Mac)
  - [ ] `scripts/stop.bat` (Windows)
- [ ] Set up `.env` with placeholder `OPENROUTER_API_KEY`
- [ ] Create `.dockerignore` and `.gitignore`
- [ ] Implement FastAPI endpoints:
  - [ ] `GET /` - Serves static "Hello World" HTML (or empty placeholder)
  - [ ] `GET /api/health` - Returns `{"status": "ok"}`
  - [ ] `POST /api/echo` - Echo test endpoint (accepts JSON, returns it back)
- [ ] Update `backend/AGENTS.md` with backend architecture

### Tests & Validation (Backend)

- [ ] Unit tests:
  - [ ] Health check endpoint returns 200 + correct JSON
  - [ ] Echo endpoint reflects input correctly
  - [ ] 404 on undefined routes
- [ ] Integration tests:
  - [ ] Docker build succeeds
  - [ ] Container starts without errors
  - [ ] `http://localhost:8000/api/health` returns `{"status": "ok"}`
- [ ] Script validation:
  - [ ] Start scripts successfully launch container
  - [ ] Stop scripts cleanly shut down container
  - [ ] No leftover processes/ports

### Success Criteria

- [ ] Docker image builds successfully
- [ ] Container runs locally on port 8000
- [ ] `curl http://localhost:8000/` returns static HTML
- [ ] `curl http://localhost:8000/api/health` returns `{"status": "ok"}`
- [ ] `POST /api/echo` works
- [ ] Start/stop scripts work for OS (Linux for this environment)
- [ ] Backend test coverage: **80%+**
- [ ] Zero errors in container logs

---

## Part 3: Integrate Frontend (Static Build & Serve)

**Goal**: Frontend built statically and served at `/`; full Kanban board accessible.

### Sub-tasks

- [ ] Add frontend build to `Dockerfile`:
  - [ ] `npm install` in frontend
  - [ ] `npm run build` to generate `.next/` static export
  - [ ] Copy `.next/standalone` to backend serving directory
- [ ] Create FastAPI route `GET /` to serve frontend:
  - [ ] Serve `index.html` for root and nested routes (SPA fallback)
  - [ ] Serve static assets from `.next/public/` with proper cache headers
- [ ] Update Docker compose or run scripts to ensure assets are available
- [ ] Test locally:
  - [ ] Frontend builds without errors
  - [ ] `http://localhost:8000/` displays Kanban board
  - [ ] All CSS and fonts load correctly
  - [ ] Drag-drop, add/delete/rename cards work in browser

### Tests & Validation

- [ ] Unit tests (frontend):
  - [ ] All existing tests still pass (moveCard, KanbanBoard, etc.)
  - [ ] No new JS errors in console
- [ ] Integration tests:
  - [ ] E2E: Navigate to `/` → Kanban Board renders
  - [ ] E2E: Drag a card → position updates
  - [ ] E2E: Add/delete/rename card → UI updates
  - [ ] E2E: Refresh page → board state is LOST (in-memory, not persisted yet)
- [ ] Docker tests:
  - [ ] Build includes frontend assets
  - [ ] Container serves frontend + backend routes
- [ ] Combined coverage: **80%+** (frontend + backend)

### Success Criteria

- [ ] `http://localhost:8000/` displays full Kanban UI (no login yet)
- [ ] All 5 columns visible with sample cards
- [ ] Drag-drop, add, delete, rename all functional in browser
- [ ] Page refresh erases board changes (expected in Part 3)
- [ ] No 404s for assets or API routes
- [ ] Lighthouse performance score > 80
- [ ] Test coverage: **80%+**

---

## Part 4: Authentication - Login/Logout

**Goal**: Add login gate; only hardcoded user ("user"/"password") can access Kanban. Logout returns to login.

### Sub-tasks

- [ ] Create login UI component (`frontend/src/components/LoginForm.tsx`):
  - [ ] Username field
  - [ ] Password field
  - [ ] Submit button (styled with color scheme)
  - [ ] Error message display
- [ ] Create auth context/hook (`frontend/src/lib/auth.ts`):
  - [ ] `useAuth()` hook for session management
  - [ ] `login(username, password)` - validates against hardcoded credentials
  - [ ] `logout()` - clears session
  - [ ] Persist auth state in localStorage
- [ ] Update root layout to check auth:
  - [ ] If not logged in: redirect to login page
  - [ ] If logged in: render Kanban
- [ ] Create logout button in Kanban header
- [ ] Backend prep (for Part 6):
  - [ ] Add `POST /api/login` endpoint (accepts username/password, returns token)
  - [ ] Add middleware to validate token on protected routes

### Tests & Validation

- [ ] Unit tests:
  - [ ] `login("user", "password")` succeeds
  - [ ] `login("wrong", "creds")` fails with error message
  - [ ] `logout()` clears session
  - [ ] Auth state persists in localStorage
- [ ] Integration tests (Playwright):
  - [ ] Load `/` → redirected to login
  - [ ] Enter wrong credentials → error shown
  - [ ] Enter `user`/`password` → redirected to Kanban
  - [ ] Click logout → redirected to login
  - [ ] Refresh while logged in → stay logged in
  - [ ] Refresh while logged out → redirect to login
- [ ] Combined coverage: **80%+**

### Success Criteria

- [ ] Login page shown at index initially
- [ ] Hardcoded credentials ("user", "password") work
- [ ] Invalid credentials show error
- [ ] After login, full Kanban board visible
- [ ] Logout button visible in header
- [ ] Logout clears session, redirects to login
- [ ] Session persists across page refresh
- [ ] No sensitive data in localStorage (or only encrypted token)
- [ ] Test coverage: **80%+**

---

## Part 5: Database Schema Design

**Goal**: Propose and document SQLite schema; get user approval.

### Sub-tasks

- [ ] Design schema (save as docs/DATABASE_SCHEMA.md):
  - [ ] **users** table: id, username, created_at
  - [ ] **boards** table: id, user_id, title, created_at, updated_at
  - [ ] **columns** table: id, board_id, title, position, created_at
  - [ ] **cards** table: id, column_id, title, details, position, created_at, updated_at
  - [ ] **chat_history** table: id, board_id, role (user/assistant), content, created_at
- [ ] Include rationale:
  - [ ] Why SQLite (local, simple, no setup)
  - [ ] Why normalize (easy to query, flexible for AI chat)
  - [ ] Foreign keys & indexes for performance
  - [ ] Position fields for ordering (allows custom sort)
- [ ] Document example JSON structure for API payloads
- [ ] Document sample queries (read board, update card, etc.)
- [ ] Create migration strategy (auto-create if missing)

### Tests & Validation

- [x] Schema review with user
- [ ] Schema validates against requirements:
  - [ ] Supports multiple users
  - [ ] Each user has 1 board (MVP), can extend to many
  - [ ] Stores column titles, card titles/details, order
  - [ ] Stores chat history for AI context

### Success Criteria

- [x] Database schema documented in `docs/DATABASE_SCHEMA.md` with SQL DDL
- [x] User reviews and approves schema
- [ ] Schema supports all features (board, columns, cards, chat)
- [ ] Normalized design (no data duplication)
- [ ] Clear migration approach

---

## Part 6: Backend API & Persistence

**Goal**: Implement CRUD API routes; read/write boards to SQLite. Auto-create DB if missing.

### Sub-tasks

- [ ] Set up SQLAlchemy or sqlite3:
  - [ ] Database initialization (`backend/db.py`)
  - [ ] Models/schemas (user, board, column, card, chat_history)
  - [ ] Auto-migrate on startup
- [ ] Implement API routes:
  - [ ] `POST /api/login` - Authenticate, return token/session
  - [ ] `GET /api/user/board` - Fetch user's board (all columns + cards)
  - [ ] `PUT /api/board` - Update board (rename columns, save full state)
  - [ ] `POST /api/cards` - Create card in column
  - [ ] `PUT /api/cards/{id}` - Update card (title, details)
  - [ ] `DELETE /api/cards/{id}` - Delete card
  - [ ] `POST /api/columns/{id}/move` - Reorder column
- [ ] Add authentication middleware:
  - [ ] Extract token from headers/session
  - [ ] Validate user ownership of board
- [ ] Create fixtures for testing:
  - [ ] Sample board with 5 columns, 8 cards
  - [ ] Multiple test users with different boards

### Tests & Validation (Backend)

- [ ] Unit tests:
  - [ ] DB initialization succeeds
  - [ ] Models can be created/updated/deleted
  - [ ] Queries return expected data shapes
  - [ ] Auth middleware validates tokens
- [ ] Integration tests:
  - [ ] `POST /api/login` returns token
  - [ ] Unauthenticated requests to protected routes return 401
  - [ ] `GET /api/user/board` returns user's board
  - [ ] `POST /api/cards` adds card, updates DB
  - [ ] `DELETE /api/cards/{id}` removes card
  - [ ] `PUT /api/board` updates columns/cards atomically
- [ ] Database tests:
  - [ ] DB file created if missing
  - [ ] Concurrent requests don't corrupt data
  - [ ] Transactions work correctly

### Success Criteria

- [ ] SQLite DB created at startup (if missing)
- [ ] All CRUD operations work via API
- [ ] Auth middleware prevents unauthorized access
- [ ] Responses match expected JSON schemas
- [ ] Data persists across server restarts
- [ ] Backend test coverage: **80%+**
- [ ] No N+1 queries; efficient SQL

---

## Part 7: Connect Frontend to Backend API

**Goal**: Frontend uses backend API instead of in-memory state; data persists.

### Sub-tasks

- [ ] Create API client (`frontend/src/lib/api.ts`):
  - [ ] `fetchBoard()` - GET /api/user/board
  - [ ] `updateBoard(columns, cards)` - PUT /api/board
  - [ ] `addCard(columnId, title, details)` - POST /api/cards
  - [ ] `updateCard(cardId, title, details)` - PUT /api/cards/{id}
  - [ ] `deleteCard(cardId)` - DELETE /api/cards/{id}
- [ ] Update KanbanBoard component:
  - [ ] Replace `useState` with `useEffect` + API calls
  - [ ] Show loading states (spinner while fetching)
  - [ ] Handle errors (toast notifications)
  - [ ] Debounce rapid updates (delay before API call)
- [ ] Update all card operations:
  - [ ] Add → calls `addCard` API
  - [ ] Delete → calls `deleteCard` API
  - [ ] Rename column → calls `updateBoard` with new title
  - [ ] Drag + drop → calls `updateBoard` with new card order
- [ ] Add error handling & retry logic:
  - [ ] Network errors show user-friendly message
  - [ ] Retry failed requests automatically
  - [ ] Sync local state if API conflict

### Tests & Validation (Frontend + Backend)

- [ ] Unit tests:
  - [ ] API client methods format requests correctly
  - [ ] Error responses handled gracefully
- [ ] Integration tests (Playwright):
  - [ ] Load board → data fetched from API
  - [ ] Add card → appears immediately, persists after refresh
  - [ ] Delete card → removed from UI and DB
  - [ ] Rename column → update persists
  - [ ] Drag card → position saved to DB
  - [ ] Network error → user sees error message, can retry
- [ ] Load tests:
  - [ ] Handle rapid updates (spam delete/add)
  - [ ] No duplicate cards or out-of-sync state

### Success Criteria

- [ ] Frontend fetches initial board from backend
- [ ] All CRUD operations use API (not local state)
- [ ] Changes persist after page refresh
- [ ] Loading states shown during API calls
- [ ] Error messages for failed requests
- [ ] No jank or race conditions
- [ ] Test coverage: **80%+** (frontend + backend)

---

## Part 8: AI Connectivity Test

**Goal**: Backend can call OpenRouter API; verify with simple "2+2=" test.

### Sub-tasks

- [ ] Load `OPENROUTER_API_KEY` from `.env`
- [ ] Create AI module (`backend/ai.py`):
  - [ ] Init OpenAI client with OpenRouter base URL
  - [ ] Implement `call_ai(prompt: str) → str` function
  - [ ] Use model: `openai/gpt-oss-120b`
  - [ ] Handle timeouts and retries
- [ ] Create test endpoint:
  - [ ] `POST /api/ai/test` - Accepts prompt, calls AI, returns response
- [ ] Manual testing:
  - [ ] Curl with prompt: "What is 2+2?"
  - [ ] Verify response contains "4"
- [ ] Add error handling:
  - [ ] Missing API key → 500 with descriptive error
  - [ ] API rate limit → 429 with retry-after
  - [ ] Network timeout → 503 with message

### Tests & Validation

- [ ] Unit tests:
  - [ ] `call_ai()` with mock response
  - [ ] Timeout handling
  - [ ] API key validation
- [ ] Integration tests:
  - [ ] `POST /api/ai/test` with valid key → responds with AI answer
  - [ ] `POST /api/ai/test` with invalid/missing key → 500 error
  - [ ] Response time < 10s

### Success Criteria

- [ ] AI endpoint reachable and responds
- [ ] Simple math test (2+2) answered correctly
- [ ] API key properly loaded from `.env`
- [ ] Error handling for missing/invalid key
- [ ] Logs show API request/response (for debugging)

---

## Part 9: AI with Kanban Context & Structured Outputs

**Goal**: AI receives board JSON + chat history; responds with structured output (text + optional board updates).

### Sub-tasks

- [ ] Define structured output schema (`backend/schemas.py`):
  - [ ] `response: str` - Text reply to user
  - [ ] `board_updates: Optional[BoardUpdate]` - Changes to board (new cards, move, delete, etc.)
  - [ ] Example: `{"response": "Created 3 tasks", "board_updates": {"cards": [...], "columns": [...]}}`
- [ ] Create chat endpoint:
  - [ ] `POST /api/chat` - Accepts user message + current board state
  - [ ] Load chat history for context
  - [ ] Build AI prompt: board JSON + chat history + user message
  - [ ] Call `call_ai()` with prompt
  - [ ] Parse structured output (use JSON mode in model if available)
  - [ ] Apply board updates if present
  - [ ] Save chat message + response to DB
  - [ ] Return structured response
- [ ] Implement board update logic:
  - [ ] AI can create cards: `{"action": "create_card", "column": "col-id", "title": "...", "details": "..."}`
  - [ ] AI can move cards: `{"action": "move_card", "card_id": "...", "target_column": "..."}`
  - [ ] AI can delete cards: `{"action": "delete_card", "card_id": "..."}`
  - [ ] Validate updates before applying
- [ ] Add conversation history:
  - [ ] Load recent chat messages for context (last 5-10 messages)
  - [ ] Include in AI prompt to enable multi-turn conversations

### Tests & Validation

- [ ] Unit tests:
  - [ ] Prompt generation includes board + history
  - [ ] Structured output parsing works
  - [ ] Board update validation (no orphaned cards, etc.)
- [ ] Integration tests:
  - [ ] `POST /api/chat` with board + message → AI response received
  - [ ] Response includes description of changes
  - [ ] If board_updates present → DB reflects changes
  - [ ] Chat history saved and retrieved correctly
  - [ ] Multi-turn conversation maintains context

### Success Criteria

- [ ] AI receives board context + chat history
- [ ] Structured output schema defined and enforced
- [ ] AI can create/move/delete cards via structured output
- [ ] Updates applied correctly to database
- [ ] Chat history preserved and contexts
- [ ] Test coverage: **80%+**

---

## Part 10: AI Chat Sidebar & Real-time Updates

**Goal**: Beautiful sidebar with full chat; AI updates to board trigger UI refresh.

### Sub-tasks

- [ ] Create chat sidebar component (`frontend/src/components/AIChatSidebar.tsx`):
  - [ ] Message list (scrollable, auto-scroll to bottom)
  - [ ] User message input + send button
  - [ ] Loading state while AI responds (spinner)
  - [ ] Display assistant responses in bubbles
  - [ ] Show when AI updates board (e.g., "Created: Task X", "Moved: Task Y to Review")
- [ ] Integrate chat with board:
  - [ ] Send current board state + chat history to API
  - [ ] Receive structured response
  - [ ] If `board_updates` present: apply to local state + refresh UI
  - [ ] No page refresh needed (smooth UX)
- [ ] Add chat to main layout:
  - [ ] Toggle sidebar (button in header or always open)
  - [ ] Sidebar 30-40% width, responsive (mobile: full width, stacked)
- [ ] Styling:
  - [ ] Use color scheme (blue for user, purple for AI, yellow accents)
  - [ ] Smooth animations for messages, board updates
  - [ ] Clear visual feedback for card changes

### Tests & Validation

- [ ] Unit tests:
  - [ ] Chat component renders messages
  - [ ] Input field captures text, sends on submit
- [ ] Integration tests (Playwright):
  - [ ] Sidebar opens/closes
  - [ ] Type message → send → AI response appears
  - [ ] AI creates card → board updates in real-time
  - [ ] AI moves card → visible in board immediately
  - [ ] Refresh page → chat history and board state persist
  - [ ] Mobile: sidebar responsive
  - [ ] Accessibility: keyboard navigation, screen reader support

### Success Criteria

- [ ] Sidebar visible with chat interface
- [ ] User types message, AI responds within 5 seconds
- [ ] AI can modify board (create/move/delete cards)
- [ ] Board updates reflected in UI without page refresh
- [ ] Chat history persists across sessions
- [ ] Responsive design (desktop, tablet, mobile)
- [ ] Test coverage: **80%+** (frontend + backend)
- [ ] No console errors or performance issues

---

## Testing Strategy - 80% Coverage Target

### By Part

| Part | Frontend | Backend | E2E | Coverage Target |
| ---- | -------- | ------- | --- | --------------- |
| 1    | -        | -       | -   | N/A (review)    |
| 2    | -        | 80%+    | -   | 80%+ backend    |
| 3    | 80%+     | 85%+    | Yes | 80%+ combined   |
| 4    | 80%+     | 85%+    | Yes | 80%+ combined   |
| 5    | -        | -       | -   | N/A (schema)    |
| 6    | -        | 85%+    | -   | 85%+ backend    |
| 7    | 80%+     | 85%+    | Yes | 80%+ combined   |
| 8    | -        | 80%+    | -   | 80%+ backend    |
| 9    | -        | 85%+    | -   | 85%+ backend    |
| 10   | 80%+     | 85%+    | Yes | 80%+ combined   |

### Coverage Tools

- **Frontend**: Vitest + @vitest/coverage-v8 (report: coverage/index.html)
- **Backend**: pytest + coverage (report: htmlcov/index.html)
- **E2E**: Playwright (tests only, no coverage metrics)
- **Combined**: Run both, merge reports for final total

### What to Test (80% ≈ Happy Path + Critical Edge Cases)

- ✓ Happy paths (main flows)
- ✓ Error cases (invalid input, missing data, auth failures)
- ✓ Edge cases (empty board, max columns, rapid updates)
- ✓ Integration between components/services
- ✓ Database transactions and consistency
- ✗ Skip: Rare network timeouts, third-party service outages (unless critical)

### Reporting

- Each part includes test summary in commit
- Coverage badge in README
- Failed tests block merge until fixed

---

## Coding Standards (Applied Throughout)

1. **Latest Versions**: React 19, Next.js 16, Python 3.12+, FastAPI latest
2. **Simplicity**: No over-engineering, no extra features; focus on MVP
3. **Conciseness**: Minimal README, no jargon, clear code comments only when needed
4. **Root Cause**: Always prove issues with evidence before fixing
5. **TypeScript**: All frontend code; backend uses type hints (Python 3.10+)
6. **Error Handling**: User-friendly messages, proper HTTP status codes
7. **No Emojis**: In code, docs, or logs

---

## Success Definition (MVP Complete)

- [x] Part 1: Plan approved by user
- [ ] Part 2: Docker + backend "hello world" working
- [ ] Part 3: Frontend served statically at `/`
- [ ] Part 4: Login/logout functional
- [ ] Part 5: DB schema approved
- [ ] Part 6: Backend CRUD API complete, 80%+ tests
- [ ] Part 7: Frontend uses API, data persists
- [ ] Part 8: AI connectivity verified (2+2 test)
- [ ] Part 9: AI receives board context, structured outputs
- [ ] Part 10: Chat sidebar, real-time board updates
- [ ] **Combined test coverage: 80%+**
- [ ] **Zero critical bugs, all features working**
- [ ] **App runs in Docker, reproducible locally**

---

## Next Steps

1. ✅ User reviews this plan
2. ⏳ User approves or requests changes
3. Start Part 2 (Docker & scaffolding)
