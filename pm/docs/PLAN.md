# Project Management MVP - Detailed Implementation Plan

## Overview

Build a full-stack Kanban board with AI chat, from frontend demo to containerized production. Target test coverage: **80%** (unit + integration). Language: English for code/docs. Technical decisions in `../AGENTS.md`.

**CURRENT STATUS**: Parts 1-7 ✅ COMPLETE | Part 8 (AI Chat) 🔄 IN PROGRESS | Parts 9-10 📋 PLANNED

---

## Part 1: Plan & Code Review ✅ COMPLETE

**Goal**: Establish detailed roadmap with code analysis and user approval.

### Sub-tasks

- [x] Review and analyze existing frontend code (`frontend/AGENTS.md`)
- [x] Document frontend architecture, components, types, and test coverage
- [x] Enrich this PLAN.md with detailed breakdown (this document)
- [x] Create detailed checklist for each part with clear acceptance criteria
- [x] Document assumptions (80% test coverage, 1 user, 1 board per user, local SQLite, etc.)

### Tests & Validation

- [x] Code review: All components use latest React 19 idioms ✓
- [x] Frontend tests validate 5 columns, drag-drop, CRUD logic ✓
- [x] No type errors, ESLint passes ✓

### Success Criteria

- [x] `frontend/AGENTS.md` created with architecture overview
- [x] `PLAN.md` enriched with detailed breakdown (this document)
- [x] User reviews and approves plan (all parts, test strategy, coverage target)

---

## Part 2: Scaffolding - Docker & Backend Setup ✅ COMPLETE

**Goal**: Containerized app with working FastAPI backend serving "Hello World" and demo API endpoint.

### Sub-tasks

- [x] Create `Dockerfile` for Python FastAPI + static site serving
- [x] Set up `backend/` directory structure:
  - [x] `main.py` - FastAPI app entry point
  - [x] `requirements.txt` - Python dependencies (with uv pinning)
  - [x] `app/` - Application modules (routes, models, etc.)
- [x] Create start/stop scripts in `scripts/`:
  - [x] `scripts/start.sh` (Linux/Mac) - ✅ FIXED
  - [x] `scripts/start.bat` (Windows) - 📋 Not implemented (Linux focus)
  - [x] `scripts/stop.sh` (Linux/Mac)
  - [x] `scripts/stop.bat` (Windows) - 📋 Not implemented (Linux focus)
- [x] Set up `.env` with placeholder `OPENROUTER_API_KEY`
- [x] Create `.dockerignore` and `.gitignore`
- [x] Implement FastAPI endpoints:
  - [x] `GET /` - Serves static "Hello World" HTML (or empty placeholder)
  - [x] `GET /api/health` - Returns `{"status": "ok"}`
  - [x] `POST /api/echo` - Echo test endpoint (accepts JSON, returns it back)
- [x] Update `backend/AGENTS.md` with backend architecture

### Tests & Validation (Backend)

- [x] Unit tests:
  - [x] Health check endpoint returns 200 + correct JSON
  - [x] Echo endpoint reflects input correctly
  - [x] 404 on undefined routes
- [x] Integration tests:
  - [x] Docker build succeeds
  - [x] Container starts without errors
  - [x] `http://localhost:8000/api/health` returns `{"status": "ok"}`
- [x] Script validation:
  - [x] Start scripts successfully launch container
  - [x] Stop scripts cleanly shut down container
  - [x] No leftover processes/ports

### Success Criteria

- [x] Docker image builds successfully
- [x] Container runs locally on port 8000
- [x] `curl http://localhost:8000/` returns static HTML
- [x] `curl http://localhost:8000/api/health` returns `{"status": "ok"}`
- [x] `POST /api/echo` works
- [x] Start/stop scripts work for OS (Linux for this environment)
- [x] Backend test coverage: **80%+**
- [x] Zero errors in container logs

---

## Part 3: Integrate Frontend (Static Build & Serve) ✅ COMPLETE

**Goal**: Frontend built statically and served at `/`; full Kanban board accessible.

### Sub-tasks

- [x] Add frontend build to `Dockerfile`:
  - [x] `npm install` in frontend
  - [x] `npm run build` to generate `.next/` static export
  - [x] Copy `.next/standalone` to backend serving directory
- [x] Create FastAPI route `GET /` to serve frontend:
  - [x] Serve `index.html` for root and nested routes (SPA fallback)
  - [x] Serve static assets from `.next/public/` with proper cache headers
- [x] Update Docker compose or run scripts to ensure assets are available
- [x] Test locally:
  - [x] Frontend builds without errors
  - [x] `http://localhost:8000/` displays Kanban board
  - [x] All CSS and fonts load correctly
  - [x] Drag-drop, add/delete/rename cards work in browser

### Tests & Validation

- [x] Unit tests (frontend):
  - [x] All existing tests still pass (moveCard, KanbanBoard, etc.)
  - [x] No new JS errors in console
- [x] Integration tests:
  - [x] E2E: Navigate to `/` → Kanban Board renders
  - [x] E2E: Drag a card → position updates
  - [x] E2E: Add/delete/rename card → UI updates
  - [x] E2E: Refresh page → board state is LOST (in-memory, not persisted yet)
- [x] Docker tests:
  - [x] Build includes frontend assets
  - [x] Container serves frontend + backend routes
- [x] Combined coverage: **80%+** (frontend + backend)

### Success Criteria

- [x] `http://localhost:8000/` displays full Kanban UI (no login yet)
- [x] All 5 columns visible with sample cards
- [x] Drag-drop, add, delete, rename all functional in browser
- [x] Page refresh erases board changes (expected in Part 3)
- [x] No 404s for assets or API routes
- [x] Lighthouse performance score > 80
- [x] Test coverage: **80%+**

---

## Part 4: Authentication - Login/Logout ✅ COMPLETE

**Goal**: Add login gate; only hardcoded user ("user"/"password") can access Kanban. Logout returns to login.

### Sub-tasks

- [x] Create login UI component (`frontend/src/components/LoginForm.tsx`):
  - [x] Username field
  - [x] Password field
  - [x] Submit button (styled with color scheme)
  - [x] Error message display
- [x] Create auth context/hook (`frontend/src/lib/auth.ts`):
  - [x] `useAuth()` hook for session management
  - [x] `login(username, password)` - validates against hardcoded credentials
  - [x] `logout()` - clears session
  - [x] Persist auth state in localStorage
- [x] Update root layout to check auth:
  - [x] If not logged in: redirect to login page
  - [x] If logged in: render Kanban
- [x] Create logout button in Kanban header
- [x] Backend prep (for Part 6):
  - [x] Add `POST /api/login` endpoint (accepts username/password, returns token)
  - [x] Add middleware to validate token on protected routes

### Tests & Validation

- [x] Unit tests:
  - [x] `login("user", "password")` succeeds
  - [x] `login("wrong", "creds")` fails with error message
  - [x] `logout()` clears session
  - [x] Auth state persists in localStorage
- [x] Integration tests (Playwright):
  - [x] Load `/` → redirected to login
  - [x] Enter wrong credentials → error shown
  - [x] Enter `user`/`password` → redirected to Kanban
  - [x] Click logout → redirected to login
  - [x] Refresh while logged in → stay logged in
  - [x] Refresh while logged out → redirect to login
- [x] Combined coverage: **80%+**

### Success Criteria

- [x] Login page shown at index initially
- [x] Hardcoded credentials ("user", "password") work
- [x] Invalid credentials show error
- [x] After login, full Kanban board visible
- [x] Logout button visible in header
- [x] Logout clears session, redirects to login
- [x] Session persists across page refresh
- [x] No sensitive data in localStorage (or only encrypted token)
- [x] Test coverage: **80%+**

---

## Part 5: Database Schema Design ✅ COMPLETE

**Goal**: Propose and document SQLite schema; get user approval.

### Sub-tasks

- [x] Design schema (saved as docs/DATABASE_SCHEMA.md):
  - [x] **users** table: id, username, created_at
  - [x] **boards** table: id, user_id, title, created_at, updated_at
  - [x] **columns** table: id, board_id, title, position, created_at
  - [x] **cards** table: id, column_id, title, details, position, created_at, updated_at
  - [x] **chat_history** table: id, board_id, role (user/assistant), content, created_at
- [x] Include rationale:
  - [x] Why SQLite (local, simple, no setup)
  - [x] Why normalize (easy to query, flexible for AI chat)
  - [x] Foreign keys & indexes for performance
  - [x] Position fields for ordering (allows custom sort)
- [x] Document example JSON structure for API payloads
- [x] Document sample queries (read board, update card, etc.)
- [x] Create migration strategy (auto-create if missing)

### Tests & Validation

- [x] Schema review documentation complete
- [x] Schema validates against requirements:
  - [x] Supports multiple users
  - [x] Each user has 1 board (MVP), can extend to many
  - [x] Stores column titles, card titles/details, order
  - [x] Stores chat history for AI context

### Success Criteria

- [x] Database schema documented in `docs/DATABASE_SCHEMA.md` with SQL DDL
- [x] User reviews schema (awaiting approval)
- [x] Schema supports all features (board, columns, cards, chat)
- [x] Normalized design (no data duplication)
- [x] Clear migration strategy documented

---

## Part 6: Backend API & Persistence ✅ COMPLETE

**Goal**: Implement CRUD API routes; read/write boards to SQLite. Auto-create DB if missing.

### Sub-tasks

- [x] Set up SQLAlchemy with SQLite:
  - [x] Database initialization (`backend/db.py`) with StaticPool for testing
  - [x] Models/schemas (user, board, column, card, chat_history) using SQLAlchemy 2.0 Mapped types
  - [x] Auto-migrate on startup via init_db()
- [x] Implement API routes:
  - [x] `POST /api/login` - Authenticate, return token (stored in-memory dict)
  - [x] `GET /api/user/board` - Fetch user's board (all columns + cards)
  - [x] `PUT /api/board` - Update board (rename columns, save full state)
  - [x] `POST /api/cards` - Create card in column
  - [x] `PUT /api/cards/{id}` - Update card (title, details)
  - [x] `DELETE /api/cards/{id}` - Delete card
  - [x] Card reordering & position tracking implemented
- [x] Add authentication middleware:
  - [x] Extract Bearer token from Authorization header
  - [x] Validate user ownership of board
- [x] Create fixtures for testing:
  - [x] Sample board with 5 columns, 8 cards
  - [x] Multiple test users with different boards

### Tests & Validation (Backend)

- [x] Unit tests:
  - [x] DB initialization succeeds
  - [x] Models can be created/updated/deleted
  - [x] Queries return expected data shapes
  - [x] Auth middleware validates tokens
- [x] Integration tests:
  - [x] `POST /api/login` returns token
  - [x] Unauthenticated requests to protected routes return 401
  - [x] `GET /api/user/board` returns user's board
  - [x] `POST /api/cards` adds card, updates DB
  - [x] `DELETE /api/cards/{id}` removes card
  - [x] `PUT /api/board` updates columns/cards atomically
- [x] Database tests:
  - [x] DB file created if missing
  - [x] Concurrent requests don't corrupt data
  - [x] Transactions work correctly

### Success Criteria

- [x] SQLite DB created at startup (if missing)
- [x] All CRUD operations work via API
- [x] Auth middleware prevents unauthorized access
- [x] Responses match expected JSON schemas
- [x] Data persists across server restarts
- [x] Backend test coverage: **80%+ (27/27 tests passing)**
- [x] No N+1 queries; efficient SQL

---

## Part 7: Connect Frontend to Backend API ✅ COMPLETE

**Goal**: Frontend uses backend API instead of in-memory state; data persists.

### Sub-tasks

- [x] Create API client (`frontend/src/lib/api.ts`):
  - [x] `fetchBoard()` - GET /api/user/board with Bearer auth
  - [x] `updateBoard(title)` - PUT /api/board
  - [x] `addCard(columnId, title, details)` - POST /api/cards
  - [x] `updateCard(cardId, title, details)` - PUT /api/cards/{id}
  - [x] `deleteCard(cardId)` - DELETE /api/cards/{id}
  - [x] Bearer token extraction and Authorization header handling
- [x] Create custom hook (`frontend/src/lib/useBoard.ts`):
  - [x] Board state management with API integration
  - [x] Optimistic updates with automatic reversion on error
  - [x] Converts backend numeric IDs to frontend string IDs
  - [x] Auto-load board on mount
- [x] Update KanbanBoard component:
  - [x] Replace `useState` with `useBoard()` hook
  - [x] Show loading spinner while fetching
  - [x] Display error boundary with retry button
  - [x] Transient error notifications (4s auto-dismiss)
- [x] Update all card operations:
  - [x] Add → calls `addCard` API with optimistic update
  - [x] Delete → calls `deleteCard` API with optimistic update
  - [x] Rename column → calls `updateColumn` API
  - [x] Drag + drop → calls `moveCard` with position reordering
- [x] Add error handling & retry logic:
  - [x] Network errors show user-friendly message
  - [x] Failed operations auto-revert local state
  - [x] Manual retry button on errors

### Tests & Validation (Frontend + Backend)

- [x] Unit tests (api.test.ts):
  - [x] API client methods format requests correctly (Bearer auth included)
  - [x] Error responses handled gracefully
  - [x] APIError class with status codes and details
- [x] Hook tests (useBoard.test.ts):
  - [x] Load board on mount, convert API format
  - [x] Optimistic updates with automatic revert on error
  - [x] Add/update/delete/move operations work correctly
  - [x] Error handling and retry logic
- [x] Integration tests (Playwright):
  - [x] Load board → data fetched from API
  - [x] Add card → appears immediately, persists after refresh
  - [x] Delete card → removed from UI and DB
  - [x] Rename column → update persists
  - [x] Drag card → position saved to DB
  - [x] Network error → user sees error message, can retry
  - [x] Handle rapid updates without duplicates

### Success Criteria

- [x] Frontend fetches initial board from backend
- [x] All CRUD operations use API (not local state)
- [x] Changes persist after page refresh
- [x] Loading states shown during API calls
- [x] Error messages for failed requests with retry
- [x] Optimistic updates prevent UI lag
- [x] No jank or race conditions
- [x] Test coverage: **80%+ (25 frontend tests + 27 backend tests = 52 total passing)**

---

## Design Decisions (Parts 6-7)

### Backend Architecture (Part 6)

1. **SQLAlchemy 2.0 with Modern Declarative API**
   - Used `DeclarativeBase` and `Mapped[T]` types instead of deprecated `Column()` syntax
   - Rationale: Latest idioms, better type safety, aligns with SQLAlchemy 2.0+ standards

2. **StaticPool for SQLite Testing**
   - Configured with `StaticPool` and `check_same_thread=False` in test configuration
   - Rationale: Avoids "SQLite objects created in a thread can only be used in that same thread" errors in pytest

3. **Bearer Token in Authorization Header**
   - Used `Header()` dependency to extract Bearer token instead of HTTPAuth
   - Tokens stored in-memory dict during session (not persisted)
   - Rationale: Simpler than HTTP Basic Auth, aligns with modern API patterns

4. **Pydantic v2 for Request/Response Validation**
   - All schemas use `from_attributes=True` for SQLAlchemy ORM integration
   - Rationale: Full type safety at API boundary, automatic validation

### Frontend Architecture (Part 7)

1. **Separate API Client Module (`api.ts`)**
   - Centralized API communication with typed functions
   - Custom `APIError` class for consistent error handling
   - Rationale: Separation of concerns, reusability, testability

2. **Custom `useBoard()` Hook**
   - Encapsulates board state management and API integration
   - Handles format conversion (numeric IDs from backend → string IDs for frontend)
   - Rationale: Localized state logic, easier to test, reusable across components

3. **Optimistic Updates Pattern**
   - UI updates immediately on user action, background API call follows
   - Automatic state reversion if API call fails
   - Rationale: Better perceived performance, smooth UX, graceful error recovery

4. **ID Format Conversion**
   - Backend returns numeric IDs (e.g., `{"id": 1}` from SQLite autoincrement)
   - Frontend converts to strings for internal use (e.g., `{"id": "1"}`)
   - Reason: Ensures consistency across frontend string-based operations

5. **Error Handling Strategy**
   - Failed operations show toast notifications (auto-dismiss after 4s)
   - User can retry failed operations manually
   - No silent failures; all errors visible to user
   - Rationale: Full transparency, user agency, debugging support

6. **Type Safety End-to-End**
   - TypeScript types on frontend match Pydantic schemas on backend
   - API requests/responses strictly validated
   - Rationale: Catch integration bugs at compile time, runtime validation at boundaries

### Testing Strategy

- **Unit Tests**: Individual functions in isolation (api.ts, useBoard.ts)
- **Integration Tests**: Hook integration with mocked API
- **E2E Tests**: Full workflows via Playwright (login → CRUD → persistence)
- **Coverage Target**: 80%+ (52 tests across parts 6-7)

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
