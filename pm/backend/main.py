"""FastAPI application entry point."""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
import secrets
import string

app = FastAPI(title="Kanban API", version="0.1.0")


# Models
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    token: str


# Hardcoded credentials for MVP (Part 4)
VALID_USERNAME = "user"
VALID_PASSWORD = "password"


def generate_token() -> str:
    """Generate a simple token for demo purposes."""
    characters = string.ascii_letters + string.digits
    return "".join(secrets.choice(characters) for _ in range(32))


# Define API routes BEFORE mounting static files
@app.post("/api/login")
async def login(request: LoginRequest):
    """Login endpoint - validates credentials and returns token."""
    if request.username != VALID_USERNAME or request.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = generate_token()
    return LoginResponse(username=request.username, token=token)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "kanban-api"}


@app.post("/api/echo")
async def echo(data: dict):
    """Echo test endpoint - returns input as-is."""
    if not data:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")
    return {"echo": data}


@app.get("/api/test-math")
async def test_math():
    """Simple test endpoint for verification."""
    return {"question": "What is 2+2?", "answer": 4}


# Mount static files AFTER API routes
# This allows /api/* routes to be handled first
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    # Mount static files with html=True for SPA fallback
    # All unmatched routes will serve index.html
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    # Fallback for when static files don't exist yet
    # (useful during Part 2 testing without frontend build)
    @app.get("/", response_class=JSONResponse)
    async def root():
        """Root endpoint - placeholder or frontend."""
        return {
            "message": "Kanban API - Backend Ready",
            "status": "ok",
            "note": "Frontend will be served here once Part 3 is complete"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
