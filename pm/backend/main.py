"""FastAPI application with user management, multi-board support, and AI chat."""
import base64
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import sys
from typing import Optional
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent))

from db import init_db, get_db
from app.schemas import (
    LoginRequest, LoginResponse, RegisterResponse, UserCreate,
    CardCreate, CardUpdate, CardResponse,
    BoardCreate, BoardResponse, BoardSummary, BoardUpdate, BoardUpdateResponse,
    ColumnCreate, ColumnResponse,
    ChatHistoryResponse, ChatRequest, ChatResponse,
    AITestRequest, AITestResponse,
    BoardUpdateAction,
)
import app.crud as crud
import ai
import chat

init_db()

# Seed default admin user on startup
_db_gen = None


def _seed_default_user():
    from db import SessionLocal
    db = SessionLocal()
    try:
        crud.get_or_create_user(db, "user", "password")
    finally:
        db.close()


_seed_default_user()

app = FastAPI(title="Kanban API", version="1.0.0")


def generate_token(user_id: int, username: str) -> str:
    token_data = f"{user_id}:{username}"
    return base64.b64encode(token_data.encode()).decode()


def decode_token(token: str) -> tuple[int, str]:
    """Decode token and return (user_id, username)."""
    try:
        decoded = base64.b64decode(token, validate=True).decode()
        parts = decoded.split(":", 1)
        if len(parts) != 2:
            raise ValueError
        return int(parts[0]), parts[1]
    except Exception:
        raise ValueError("Invalid token")


def get_current_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> int:
    if not authorization:
        raise HTTPException(status_code=403, detail="Missing authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(status_code=403, detail="Invalid authorization header format")

    try:
        user_id, username = decode_token(parts[1])
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = crud.get_user_by_id(db, user_id)
    if not user or user.username != username:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_id


# ============= Auth Routes =============

@app.post("/api/register", response_model=RegisterResponse, status_code=201)
async def register(request: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    existing = crud.get_user_by_username(db, request.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    user = crud.create_user(db, request.username, request.password)
    # Create their first board automatically
    crud.get_or_create_user_board(db, user.id)
    token = generate_token(user.id, user.username)
    return RegisterResponse(username=user.username, token=token, user_id=user.id)


@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login and return auth token."""
    user = crud.authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Ensure user has at least one board
    crud.get_or_create_user_board(db, user.id)
    token = generate_token(user.id, user.username)
    return LoginResponse(username=user.username, token=token, user_id=user.id)


@app.post("/api/logout")
async def logout(user_id: int = Depends(get_current_user_id)):
    return {"status": "logged out"}


# ============= Board Routes =============

@app.get("/api/boards", response_model=list[BoardSummary])
async def list_boards(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all boards for the current user."""
    return crud.list_user_boards(db, user_id)


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
async def create_board(
    board_data: BoardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new board."""
    board = crud.create_board(db, user_id, board_data.title)
    _ = board.columns
    for col in board.columns:
        _ = col.cards
    return board


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a specific board by ID."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    _ = board.columns
    for col in board.columns:
        _ = col.cards
    return board


@app.put("/api/boards/{board_id}/title", response_model=BoardSummary)
async def update_board_title(
    board_id: int,
    board_data: BoardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Rename a board."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    updated = crud.update_board_title(db, board_id, board_data.title)
    return updated


@app.delete("/api/boards/{board_id}")
async def delete_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a board. User must have at least one remaining board."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    remaining = crud.list_user_boards(db, user_id)
    if len(remaining) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete your only board")

    crud.delete_board(db, board_id)
    return {"status": "deleted", "board_id": board_id}


@app.put("/api/boards/{board_id}", response_model=BoardUpdateResponse)
async def update_board(
    board_id: int,
    update: BoardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Bulk update a board's columns and cards (for drag-drop)."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    columns_updated = 0
    cards_updated = 0

    for col_update in update.columns:
        col = crud.get_column_by_id(db, col_update.id)
        if col and col.board_id == board.id:
            crud.update_column(db, col.id, col_update.title, col_update.position)
            columns_updated += 1

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
        cards_updated=cards_updated,
    )


# Legacy endpoint - returns user's first board (backward compat)
@app.get("/api/user/board", response_model=BoardResponse)
async def get_user_board(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    board = crud.get_or_create_user_board(db, user_id)
    _ = board.columns
    for col in board.columns:
        _ = col.cards
    return board


# Legacy bulk update endpoint (backward compat)
@app.put("/api/board", response_model=BoardUpdateResponse)
async def update_board_legacy(
    update: BoardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    board = crud.get_or_create_user_board(db, user_id)

    columns_updated = 0
    cards_updated = 0

    for col_update in update.columns:
        col = crud.get_column_by_id(db, col_update.id)
        if col and col.board_id == board.id:
            crud.update_column(db, col.id, col_update.title, col_update.position)
            columns_updated += 1

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
        cards_updated=cards_updated,
    )


# ============= Column Routes =============

@app.post("/api/boards/{board_id}/columns", response_model=ColumnResponse, status_code=201)
async def add_column(
    board_id: int,
    column_data: ColumnCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add a new column to a board."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    col = crud.create_column(db, board_id, column_data.title)
    _ = col.cards
    return col


@app.delete("/api/boards/{board_id}/columns/{column_id}")
async def delete_column(
    board_id: int,
    column_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a column and all its cards."""
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    col = crud.get_column_by_id(db, column_id)
    if not col or col.board_id != board_id:
        raise HTTPException(status_code=404, detail="Column not found")

    remaining = crud.get_columns_by_board(db, board_id)
    if len(remaining) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last column")

    crud.delete_column(db, column_id)
    return {"status": "deleted", "column_id": column_id}


# ============= Card Routes =============

@app.post("/api/cards", response_model=CardResponse)
async def create_card(
    card_data: CardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    col = crud.get_column_by_id(db, card_data.column_id)
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    card = crud.create_card(
        db, card_data.column_id, card_data.title, card_data.details,
        card_data.priority, card_data.due_date, card_data.color,
    )
    return card


@app.put("/api/cards/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: int,
    card_update: CardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    card = crud.get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    col = crud.get_column_by_id(db, card.column_id)
    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    updated = crud.update_card(db, card_id, card_update.model_dump(exclude_unset=True))
    return updated


@app.delete("/api/cards/{card_id}")
async def delete_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    card = crud.get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

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
    try:
        response = await ai.call_ai(request.prompt)
        return AITestResponse(prompt=request.prompt, response=response, status="success")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"AI configuration error: {str(e)}")
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=f"AI service timeout: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {type(e).__name__}: {str(e)}")


# ============= Chat Routes =============

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        if request.board_id:
            board = crud.get_board_by_id(db, request.board_id)
            if not board or board.user_id != user_id:
                raise HTTPException(status_code=404, detail="Board not found")
        else:
            board = crud.get_or_create_user_board(db, user_id)

        response = await chat.process_chat_message(
            db=db,
            board_id=board.id,
            user_message=request.message,
            board_data=request.board_state,
        )
        return response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {type(e).__name__}: {str(e)}")


@app.get("/api/chat/history", response_model=list[ChatHistoryResponse])
async def get_chat_history(
    board_id: Optional[int] = None,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if board_id:
        board = crud.get_board_by_id(db, board_id)
        if not board or board.user_id != user_id:
            raise HTTPException(status_code=404, detail="Board not found")
    else:
        board = crud.get_or_create_user_board(db, user_id)

    history = crud.get_chat_history(db, board.id)
    return history


# ============= Health & Demo Routes =============

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "kanban-api"}


@app.post("/api/echo")
async def echo(data: dict):
    if not data:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")
    return {"echo": data}


@app.get("/api/test-math")
async def test_math():
    return {"question": "What is 2+2?", "answer": 4}


# ============= Static File Serving =============

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/", response_class=JSONResponse)
    async def root():
        return {
            "message": "Kanban API - Backend Ready",
            "status": "ok",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
