"""FastAPI application entry point with database persistence."""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import secrets
import string
import sys
from typing import Optional
from sqlalchemy.orm import Session

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from db import init_db, get_db, engine
from app.models import Base
from app.schemas import (
    LoginRequest, LoginResponse, CardCreate, CardUpdate, CardResponse,
    BoardResponse, BoardUpdate, BoardUpdateResponse, ChatHistoryResponse,
    ChatRequest, ChatResponse
)
import app.crud as crud

# Initialize database
init_db()

app = FastAPI(title="Kanban API", version="0.1.0")

# Hardcoded credentials for MVP
VALID_USERNAME = "user"
VALID_PASSWORD = "password"

# Token storage (in production, use JWT or sessions in database)
# For MVP, we'll use simple in-memory storage, cleared on restart
valid_tokens: dict[str, int] = {}  # token -> user_id mapping


def generate_token(user_id: int) -> str:
    """Generate a token-based on user_id (simple, no state needed on restart)."""
    # For MVP: Use simple Base64 encoding of user_id
    # In production, use JWT with signing
    import base64
    token_data = f"{user_id}:{VALID_USERNAME}:{VALID_PASSWORD}"
    # Simple XOR-based obfuscation with a secret seed (mock, not secure)
    return base64.b64encode(token_data.encode()).decode()

def decode_token(token: str, db: Session) -> int:
    """Decode and validate token, returns user_id."""
    try:
        import base64
        
        # Ensure token is a string
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        # Strip whitespace
        token = token.strip()
        
        # Validate base64 format (should be alphanumeric + /+=)
        import string
        valid_chars = string.ascii_letters + string.digits + '/+='
        if not all(c in valid_chars for c in token):
            invalid_chars = [c for c in token if c not in valid_chars]
            raise ValueError(f"Invalid characters in token: {invalid_chars}")
        
        # Decode base64 with validation
        try:
            decoded_bytes = base64.b64decode(token, validate=True)
        except Exception as e:
            raise ValueError(f"Invalid base64: {e}")
        
        # Decode UTF-8
        try:
            decoded = decoded_bytes.decode('utf-8')
        except UnicodeDecodeError as e:
            raise ValueError(f"Invalid UTF-8 in token: {e}")
        
        parts = decoded.split(':')
        
        # Validate format
        if len(parts) != 3:
            raise ValueError(f"Invalid token format: expected 3 parts, got {len(parts)}")
        
        user_id_str, username, password = parts
        
        try:
            user_id = int(user_id_str)
        except ValueError:
            raise ValueError(f"Invalid user_id: {user_id_str}")
        
        # Validate credentials match
        if username != VALID_USERNAME or password != VALID_PASSWORD:
            raise ValueError(f"Invalid credentials in token")
        
        # Verify user exists in database
        user = crud.get_or_create_user(db, VALID_USERNAME)
        if user.id != user_id:
            raise ValueError(f"User mismatch: token has {user_id}, db has {user.id}")
        
        return user_id
        
    except ValueError as err:
        raise err
    except Exception as err:
        raise ValueError(f"Invalid token: {err}")


def get_current_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> int:
    """Extract and validate user ID from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=403, detail="Missing authorization header")
    
    # Extract token (format: "Bearer <token>")
    parts = authorization.split()
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(status_code=403, detail="Invalid authorization header format")
    
    token = parts[1]
    
    try:
        user_id = decode_token(token, db)
        print(f"✓ Token validated for user_id={user_id}")
        return user_id
    except ValueError as e:
        print(f"❌ Token validation failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))



# ============= Auth Routes =============

@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint - authenticate and return token."""
    if request.username != VALID_USERNAME or request.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Get or create user
    user = crud.get_or_create_user(db, request.username)
    
    # Create or get their board
    board = crud.get_or_create_user_board(db, user.id)
    
    # Generate token (no need to store in memory, it's self-validating)
    token = generate_token(user.id)
    
    return LoginResponse(username=user.username, token=token, user_id=user.id)


@app.post("/api/logout")
async def logout(user_id: int = Depends(get_current_user_id)):
    """Logout endpoint - client should clear token from localStorage."""
    # With stateless tokens, logout is handled client-side
    # (token is cleared from localStorage)
    return {"status": "logged out"}


# ============= Board Routes =============

@app.get("/api/user/board", response_model=BoardResponse)
async def get_user_board(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Fetch user's board with all columns and cards."""
    board = crud.get_or_create_user_board(db, user_id)
    # Force eager load of relationships by accessing them
    # This ensures Pydantic can serialize all data
    _ = board.columns  # Load all columns
    for col in board.columns:
        _ = col.cards  # Load all cards for each column
    return board


@app.put("/api/board", response_model=BoardUpdateResponse)
async def update_board(
    update: BoardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Bulk update board - update columns and cards atomically."""
    board = crud.get_or_create_user_board(db, user_id)
    
    columns_updated = 0
    cards_updated = 0
    
    # Update columns
    for col_update in update.columns:
        col = crud.get_column_by_id(db, col_update.id)
        if col and col.board_id == board.id:
            crud.update_column(db, col.id, col_update.title, col_update.position)
            columns_updated += 1
    
    # Update cards (moves and reordering)
    for card_update in update.cards:
        card = crud.get_card_by_id(db, card_update.id)
        if card:
            col = crud.get_column_by_id(db, card.column_id)
            if col and col.board_id == board.id:
                crud.move_card(db, card.id, card_update.column_id, card_update.position)
                cards_updated += 1
    
    return BoardUpdateResponse(
        success=True,
        board_id=board.id,
        columns_updated=columns_updated,
        cards_updated=cards_updated
    )


# ============= Card Routes =============

@app.post("/api/cards", response_model=CardResponse)
async def create_card(
    card_data: CardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new card in a column."""
    # Verify column belongs to user's board
    col = crud.get_column_by_id(db, card_data.column_id)
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    
    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    card = crud.create_card(db, card_data.column_id, card_data.title, card_data.details)
    return card


@app.put("/api/cards/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: int,
    card_update: CardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a card's title and/or details."""
    card = crud.get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Verify user owns the board
    col = crud.get_column_by_id(db, card.column_id)
    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    updated = crud.update_card(db, card_id, card_update.title, card_update.details)
    return updated


@app.delete("/api/cards/{card_id}")
async def delete_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a card."""
    card = crud.get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Verify user owns the board
    col = crud.get_column_by_id(db, card.column_id)
    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = crud.delete_card(db, card_id)
    if not success:
        raise HTTPException(status_code=404, detail="Card not found")
    
    return {"status": "deleted", "card_id": card_id}


# ============= Health & Demo Routes =============

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "kanban-api"}


@app.post("/api/echo")
async def echo(data: dict):
    """Echo test endpoint."""
    if not data:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")
    return {"echo": data}


@app.get("/api/test-math")
async def test_math():
    """Simple math test endpoint."""
    return {"question": "What is 2+2?", "answer": 4}


# ============= Static File Serving =============

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/", response_class=JSONResponse)
    async def root():
        """Root endpoint fallback."""
        return {
            "message": "Kanban API - Backend Ready",
            "status": "ok",
            "note": "Frontend will be served here once Part 3 is complete"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

