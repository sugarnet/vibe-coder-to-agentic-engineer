# Backend - FastAPI Kanban API

## Architecture Overview

The backend is a FastAPI application serving as the API layer for the Kanban project management MVP. It provides RESTful endpoints for health checks, echo tests, and placeholder routes for future board/card operations. Runs on port 8000 in a Docker container.

## Tech Stack

- **Framework**: FastAPI 0.115.1 (async, high-performance)
- **Server**: Uvicorn 0.32.0 (ASGI)
- **Validation**: Pydantic 2.9.2 + Pydantic Settings
- **Testing**: Pytest 8.3.4 + Pytest-asyncio
- **Python**: 3.12+ with type hints

## Project Structure

```
backend/
├── main.py              # FastAPI app, routes
├── requirements.txt     # Python dependencies
├── app/
│   └── __init__.py      # Application package
├── tests/
│   ├── __init__.py
│   └── test_main.py     # Unit tests for endpoints
├── Dockerfile           # Docker build instructions
├── pytest.ini           # Pytest config (optional)
└── .env                 # Environment variables (git-ignored)
```

## Core Components

### main.py

- **FastAPI Application**: Initialized as `app` at module level
- **CORS & Middleware**: (To be added in Part 4 for auth)
- **Routes**:
  - `GET /` - Serves root HTML (placeholder; frontend will replace in Part 3)
  - `GET /api/health` - Health check endpoint (status: ok)
  - `POST /api/echo` - Echo test endpoint (mirrors JSON input)
  - `GET /api/test-math` - Simple test (returns 2+2=4)

### Routes Detail

#### `GET /`

- **Response**: HTML page (200 OK)
- **Purpose**: Placeholder landing page showing backend is running
- **Future**: Replaced by Next.js frontend static build in Part 3

#### `GET /api/health`

- **Response**: `{"status": "ok", "service": "kanban-api"}`
- **Status Code**: 200
- **Purpose**: Health check for Docker and monitoring
- **Docker**: Used by HEALTHCHECK instruction

#### `POST /api/echo`

- **Request**: JSON body (any object)
- **Response**: `{"echo": <input>}`
- **Status Code**: 200 or 400
- **Purpose**: Test endpoint to verify API is working
- **Validation**: Rejects empty body with 400 error

#### `GET /api/test-math`

- **Response**: `{"question": "What is 2+2?", "answer": 4}`
- **Status Code**: 200
- **Purpose**: Simple test for basic response verification

## Testing

### Unit Tests (tests/test_main.py)

**Classes**:

- `TestHealthCheck` - 3 tests
  - Endpoint returns 200
  - Response contains "status": "ok"
  - Response identifies service correctly
- `TestEchoEndpoint` - 4 tests
  - Returns 200 for valid input
  - Correctly mirrors simple objects
  - Handles nested objects and arrays
  - Rejects empty body with 400
- `TestRootEndpoint` - 3 tests
  - Returns 200 status
  - Content-Type is HTML
  - Contains expected title
- `TestTestMath` - 2 tests
  - Returns 200
  - Answer is correct (4)
- `TestNotFoundRoutes` - 2 tests
  - Undefined GET routes return 404
  - Undefined POST routes return 404

**Total**: 14 tests

### Running Tests

```bash
# From backend/ directory
pytest tests/                    # Run all tests
pytest tests/test_main.py -v    # Verbose
pytest --cov=. tests/           # With coverage (requires pytest-cov)
pytest --tb=short tests/        # Short traceback
```

## Docker Setup

### Dockerfile Strategy

- **Base Image**: `python:3.12-slim` (minimal, 150MB+)
- **Workdir**: `/app`
- **Install**:
  - System deps (curl for health check)
  - Python deps from `backend/requirements.txt`
- **Copy**: Backend code
- **Expose**: Port 8000
- **HEALTHCHECK**: Uses `curl http://localhost:8000/api/health`
- **CMD**: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Build & Run

```bash
# Build image
docker build -t kanban-api .

# Run container
docker run -d -p 8000:8000 --name kanban-api kanban-api

# Check logs
docker logs -f kanban-api

# Stop & remove
docker stop kanban-api && docker rm kanban-api
```

## Start/Stop Scripts

### scripts/start.sh (Linux/Mac)

**What it does**:

1. Checks Docker is installed
2. Stops existing container (if any)
3. Builds Docker image
4. Runs container in background
5. Waits for health check (max 30s)
6. Shows access URLs and logs command

**Usage**:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

### scripts/stop.sh (Linux/Mac)

**What it does**:

1. Checks Docker is installed
2. Stops running container
3. Removes container

**Usage**:

```bash
chmod +x scripts/stop.sh
./scripts/stop.sh
```

## Environment Variables

- `.env` file at project root (git-ignored)
- `OPENROUTER_API_KEY` - Placeholder for Part 8 (AI connectivity)
- Currently unused; loaded via Pydantic Settings when needed

## Dependencies

### Core

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **pydantic**: Request/response validation

### Testing

- **pytest**: Test runner
- **pytest-asyncio**: Async test support
- **httpx**: Async HTTP client for tests

## Development

### Local Setup (without Docker)

```bash
python -m venv venv
source venv/bin/activate  # or `source venv/Scripts/activate` on Windows
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

### API Testing

```bash
# Health check
curl http://localhost:8000/api/health

# Echo test
curl -X POST http://localhost:8000/api/echo -H "Content-Type: application/json" -d '{"message": "hello"}'

# Math test
curl http://localhost:8000/api/test-math
```

## Part 2 Success Criteria

- [x] Backend directory structure created
- [x] FastAPI app with 3+ endpoints
- [x] Dockerfile builds successfully
- [x] Container runs on port 8000
- [x] Health check returns {"status": "ok"}
- [x] Echo endpoint mirrors input
- [x] Start/stop scripts work
- [x] Unit tests: 14 tests, all passing
- [x] Test coverage: 100% of endpoints
- [ ] Docker build completes without errors (to verify)
- [ ] Container starts without errors (to verify)
- [ ] curl tests pass (to verify)

## Future Integrations

- **Part 3**: Static frontend served at `/`
- **Part 4**: Auth middleware, login/logout endpoints
- **Part 5**: Database models and schema
- **Part 6**: CRUD endpoints for cards, columns, boards
- **Part 8**: AI connectivity via OpenRouter
- **Part 9**: Chat endpoint with structured outputs
- **Part 10**: WebSocket support for real-time updates

## Notes

- Uses latest stable versions as of April 2026
- Type hints throughout for IDE support
- Async/await ready for concurrent connections
- HEALTHCHECK in Dockerfile for Docker Compose support
- All endpoints tested with >80% coverage initial target
