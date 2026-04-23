# Project Structure & Organization

## Final Directory Layout

```
pm/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   └── schemas.py         # Pydantic request/response schemas
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_main.py       # Main backend test suite (27 tests)
│   │   ├── test_auth_flow.py  # Stateless token auth tests
│   │   ├── final_integration_test.py  # E2E integration tests
│   │   └── frontend_flow_test.py      # Frontend-backend flow tests
│   ├── main.py                # FastAPI application entry point
│   ├── db.py                  # Database configuration & session management
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanCard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── NewCardForm.tsx
│   │   │   ├── KanbanCardPreview.tsx
│   │   │   ├── KanbanBoard.test.tsx
│   │   │   └── KanbanCard.test.tsx
│   │   └── lib/
│   │       ├── api.ts         # API client with Bearer auth
│   │       ├── useBoard.ts    # Custom hook for board state
│   │       ├── kanban.ts      # Kanban utilities
│   │       ├── auth.ts        # Auth state management
│   │       ├── kanban.test.ts
│   │       └── api.test.ts
│   ├── tests/
│   │   ├── kanban.spec.ts     # Playwright E2E tests
│   │   └── setup.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── vitest.config.ts
│   └── playwright.config.ts
├── scripts/
│   ├── start.sh               # Start application (Linux/Mac)
│   ├── stop.sh                # Stop application (Linux/Mac)
│   ├── test-all.sh            # Run all backend tests
│   └── validate-project.sh    # Validate project structure
├── docs/
│   ├── PLAN.md                # Implementation plan & progress
│   ├── TESTING_GUIDE.md       # Testing documentation
│   ├── DATABASE_SCHEMA.md     # Database schema & relationships
│   ├── PART7_COMPLETE.md      # Part 7 completion notes
│   ├── PART7_SUMMARY.md       # Part 7 technical summary
│   └── PROJECT_STRUCTURE.md   # This file
├── AGENTS.md                  # Project MVP specification & requirements
├── Dockerfile                 # Docker configuration
├── .env                       # Environment variables (OPENROUTER_API_KEY)
├── .dockerignore              # Docker ignore patterns
└── .gitignore                 # Git ignore patterns
```

## Structure Cleanup (Completed)

### Files Relocated

| File | From | To | Reason |
|------|------|-----|--------|
| `test_auth_flow.py` | root | `backend/tests/` | Backend test file |
| `test_server.py` | root | DELETED | Redundant test file |
| `frontend_flow_test.py` | root | `backend/tests/` | Integration test |
| `final_integration_test.py` | root | `backend/tests/` | E2E integration test |
| `PART7_COMPLETE.md` | root | `docs/` | Documentation |
| `PART7_SUMMARY.txt` | root | `docs/PART7_SUMMARY.md` | Documentation |
| `TESTING_GUIDE.md` | root | `docs/` | Documentation |
| `test-all.sh` | root | `scripts/` | Testing script |
| `validate-project.sh` | root | `scripts/` | Validation script |
| `scripts/AGENTS.md` | scripts | DELETED | Empty file |

### Cleanup Date

- **Date**: Post Part 7 completion
- **Scope**: Organized scattered files into proper directories
- **Status**: ✅ COMPLETE

### Impact

- ✅ Clean project structure aligns with PLAN.md
- ✅ Backend tests grouped in `backend/tests/`
- ✅ Documentation centralized in `docs/`
- ✅ Scripts organized in `scripts/`
- ✅ No API/feature changes required
- ✅ All 52 tests remain valid (27 backend + 25 frontend)

---

## Testing Organization

### Backend Tests

- **Location**: `backend/tests/`
- **Main Suite**: `test_main.py` (27 tests covering all endpoints)
  - Authentication tests (login, token validation)
  - CRUD operations (create/read/update/delete)
  - Error handling
  - Edge cases

- **Integration Tests**: `final_integration_test.py` (7 comprehensive E2E tests)
  - User registration to board operations
  - Multi-step workflows
  - Data persistence verification

- **Auth Tests**: `test_auth_flow.py` (stateless token system)
  - Token generation (Base64 encoding)
  - Token validation
  - Bearer header extraction
  - Session persistence

- **Frontend Flow Tests**: `frontend_flow_test.py`
  - Simulates frontend login → board fetch
  - Validates API response format
  - Tests optimistic updates

### Frontend Tests

- **Location**: `frontend/src/lib/` and `frontend/src/components/`
- **Unit Tests**: 
  - `api.test.ts` - API client methods (Bearer auth, error handling)
  - `kanban.test.ts` - Kanban utilities
- **Component Tests**:
  - `KanbanBoard.test.tsx` - Board rendering & interactions
  - `KanbanCard.test.tsx` - Card rendering & events
- **E2E Tests**:
  - `tests/kanban.spec.ts` - Playwright integration tests

## Next Steps (Part 8+)

1. ✅ **Part 7 Complete**: All crud operations, authentication, tests organized
2. 🔄 **Part 8 Pending**: AI chat integration via OpenRouter
3. 📋 **Parts 9-10**: Chat context, real-time board updates, deployment

---

Last Updated: Post-Part 7 Cleanup
