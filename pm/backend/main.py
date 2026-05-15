import base64
import sys
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent))

import ai
import chat
from app import crud
from app.models import Board
from app.schemas import (
    AITestRequest, AITestResponse,
    BoardCreate, BoardResponse, BoardSummary, BoardUpdate, BoardUpdateResponse,
    CardCreate, CardResponse, CardUpdate,
    ChatHistoryResponse, ChatRequest, ChatResponse,
    ColumnCreate, ColumnResponse,
    LoginRequest, LoginResponse, RegisterResponse, UserCreate,
)
from db import SessionLocal, get_db, init_db

init_db()


def _seed_default_user():
    db = SessionLocal()
    try:
        crud.get_or_create_user(db, "user", "password")
    finally:
        db.close()


_seed_default_user()

app = FastAPI(title="Kanban API", version="1.0.0")


def generate_token(user_id: int, username: str) -> str:
    return base64.b64encode(f"{user_id}:{username}".encode()).decode()


def decode_token(token: str) -> tuple[int, str]:
    try:
        decoded = base64.b64decode(token, validate=True).decode()
        user_id_str, username = decoded.split(":", 1)
        return int(user_id_str), username
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


def _authorize_board(db: Session, board_id: int, user_id: int) -> Board:
    board = crud.get_board_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return board


def _authorize_card(db: Session, card_id: int, user_id: int):
    card = crud.get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col = crud.get_column_by_id(db, card.column_id)
    board = crud.get_board_by_id(db, col.board_id)
    if board.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return card


def _apply_bulk_update(db: Session, board: Board, update: BoardUpdate) -> BoardUpdateResponse:
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


@app.post("/api/register", response_model=RegisterResponse, status_code=201)
async def register(request: UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_username(db, request.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    user = crud.create_user(db, request.username, request.password)
    crud.get_or_create_user_board(db, user.id)
    return RegisterResponse(
        username=user.username,
        token=generate_token(user.id, user.username),
        user_id=user.id,
    )


@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    crud.get_or_create_user_board(db, user.id)
    return LoginResponse(
        username=user.username,
        token=generate_token(user.id, user.username),
        user_id=user.id,
    )


@app.post("/api/logout")
async def logout(user_id: int = Depends(get_current_user_id)):
    return {"status": "logged out"}


@app.get("/api/boards", response_model=list[BoardSummary])
async def list_boards(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return crud.list_user_boards(db, user_id)


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
async def create_board(
    board_data: BoardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return crud.create_board(db, user_id, board_data.title)


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return _authorize_board(db, board_id, user_id)


@app.put("/api/boards/{board_id}/title", response_model=BoardSummary)
async def update_board_title(
    board_id: int,
    board_data: BoardCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_board(db, board_id, user_id)
    return crud.update_board_title(db, board_id, board_data.title)


@app.delete("/api/boards/{board_id}")
async def delete_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_board(db, board_id, user_id)
    if len(crud.list_user_boards(db, user_id)) <= 1:
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
    board = _authorize_board(db, board_id, user_id)
    return _apply_bulk_update(db, board, update)


@app.get("/api/user/board", response_model=BoardResponse)
async def get_user_board(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return crud.get_or_create_user_board(db, user_id)


@app.put("/api/board", response_model=BoardUpdateResponse)
async def update_board_legacy(
    update: BoardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    board = crud.get_or_create_user_board(db, user_id)
    return _apply_bulk_update(db, board, update)


@app.post("/api/boards/{board_id}/columns", response_model=ColumnResponse, status_code=201)
async def add_column(
    board_id: int,
    column_data: ColumnCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_board(db, board_id, user_id)
    return crud.create_column(db, board_id, column_data.title)


@app.delete("/api/boards/{board_id}/columns/{column_id}")
async def delete_column(
    board_id: int,
    column_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_board(db, board_id, user_id)

    col = crud.get_column_by_id(db, column_id)
    if not col or col.board_id != board_id:
        raise HTTPException(status_code=404, detail="Column not found")

    if len(crud.get_columns_by_board(db, board_id)) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last column")

    crud.delete_column(db, column_id)
    return {"status": "deleted", "column_id": column_id}


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

    return crud.create_card(
        db, card_data.column_id, card_data.title, card_data.details,
        card_data.priority, card_data.due_date, card_data.color,
    )


@app.put("/api/cards/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: int,
    card_update: CardUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_card(db, card_id, user_id)
    return crud.update_card(db, card_id, card_update.model_dump(exclude_unset=True))


@app.delete("/api/cards/{card_id}")
async def delete_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _authorize_card(db, card_id, user_id)
    crud.delete_card(db, card_id)
    return {"status": "deleted", "card_id": card_id}


@app.post("/api/ai/test", response_model=AITestResponse)
async def test_ai(request: AITestRequest):
    try:
        response = await ai.call_ai(request.prompt)
        return AITestResponse(prompt=request.prompt, response=response, status="success")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"AI configuration error: {e}")
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=f"AI service timeout: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {type(e).__name__}: {e}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        if request.board_id:
            board = _authorize_board(db, request.board_id, user_id)
        else:
            board = crud.get_or_create_user_board(db, user_id)
        return await chat.process_chat_message(
            db=db,
            board_id=board.id,
            user_message=request.message,
            board_data=request.board_state,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {type(e).__name__}: {e}")


@app.get("/api/chat/history", response_model=list[ChatHistoryResponse])
async def get_chat_history(
    board_id: Optional[int] = None,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if board_id:
        board = _authorize_board(db, board_id, user_id)
    else:
        board = crud.get_or_create_user_board(db, user_id)
    return crud.get_chat_history(db, board.id)


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


STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/", response_class=JSONResponse)
    async def root():
        return {"message": "Kanban API - Backend Ready", "status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
