"""FastAPI application entry point with database persistence."""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
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
    ChatRequest, ChatResponse, AITestRequest, AITestResponse, BoardUpdateAction
)
import app.crud as crud
import ai
import chat

# Initialize database
init_db()

app = FastAPI(title="Kanban API", version="0.1.0")

# Hardcoded credentials for MVP
VALID_USERNAME = "user"
VALID_PASSWORD = "password"

def generate_token(user_id: int) -> str:
    """Generate a base64 token encoding user_id and credentials."""
    import base64
    token_data = f"{user_id}:{VALID_USERNAME}:{VALID_PASSWORD}"
    return base64.b64encode(token_data.encode()).decode()


def decode_token(token: str) -> int:
    """Decode and validate token, returns user_id."""
    try:
        import base64
        decoded = base64.b64decode(token, validate=True).decode()
        user_id_str, username, password = decoded.split(":", 2)
        if username != VALID_USERNAME or password != VALID_PASSWORD:
            raise ValueError
        return int(user_id_str)
    except Exception:
        raise ValueError("Invalid token")


def get_current_user_id(
    authorization: Optional[str] = Header(None),
) -> int:
    """Extract and validate user ID from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=403, detail="Missing authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(status_code=403, detail="Invalid authorization header format")

    try:
        return decode_token(parts[1])
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")



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


# ============= AI Routes =============

@app.post("/api/ai/test", response_model=AITestResponse)
async def test_ai(request: AITestRequest):
    """Test AI connectivity - call OpenRouter API with a prompt."""
    try:
        response = await ai.call_ai(request.prompt)
        return AITestResponse(
            prompt=request.prompt,
            response=response,
            status="success"
        )
    except ValueError as e:
        # Missing or invalid API key
        raise HTTPException(status_code=500, detail=f"AI configuration error: {str(e)}")
    except TimeoutError as e:
        # Request timeout
        raise HTTPException(status_code=503, detail=f"AI service timeout: {str(e)}")
    except Exception as e:
        # Other API errors
        raise HTTPException(status_code=500, detail=f"AI service error: {type(e).__name__}: {str(e)}")


# ============= Chat Routes =============

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Chat with AI assistant that can modify the board."""
    try:
        # Get user's board
        board = crud.get_or_create_user_board(db, user_id)

        # Process chat message with AI
        response = await chat.process_chat_message(
            db=db,
            board_id=board.id,
            user_message=request.message,
            board_data=request.board_state
        )

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {type(e).__name__}: {str(e)}")


@app.get("/api/chat/history", response_model=list[ChatHistoryResponse])
async def get_chat_history(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Fetch chat history for the current user's board."""
    board = crud.get_or_create_user_board(db, user_id)
    history = crud.get_chat_history(db, board.id)
    return history


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

