import bcrypt
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.models import Board, Card, ChatHistory, Column, User


DEFAULT_COLUMNS = ["To Do", "In Progress", "Review", "Done", "Backlog"]
DEFAULT_CARDS = [
    ("To Do", "Define MVP scope", "Clarify the first deliverables and timeline."),
    ("In Progress", "Build login flow", "Implement auth and user session handling."),
    ("Review", "Review board layout", "Check mobile and desktop layout for the Kanban board."),
    ("Done", "Setup basic project structure", "Initial backend, frontend, and database scaffolding."),
    ("Backlog", "Collect feature ideas", "Add any future ideas for the board and AI assistant."),
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_user(db: Session, username: str, password: str) -> User:
    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_user(db: Session, username: str, password: str | None = None) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user:
        return user
    user = User(
        username=username,
        password_hash=hash_password(password) if password else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_all_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.created_at).all()


def list_user_boards(db: Session, user_id: int) -> list[Board]:
    return db.query(Board).filter(Board.user_id == user_id).order_by(Board.created_at).all()


def create_board(db: Session, user_id: int, title: str) -> Board:
    board = Board(user_id=user_id, title=title)
    db.add(board)
    db.commit()
    db.refresh(board)

    for idx, col_title in enumerate(DEFAULT_COLUMNS):
        db.add(Column(board_id=board.id, title=col_title, position=idx))
    db.commit()
    db.refresh(board)
    return board


def get_or_create_user_board(db: Session, user_id: int) -> Board:
    board = db.query(Board).filter(Board.user_id == user_id).order_by(Board.created_at).first()
    if board:
        return board

    board = create_board(db, user_id, "My Board")
    columns_by_title = {col.title: col for col in board.columns}
    for column_name, title, details in DEFAULT_CARDS:
        column = columns_by_title.get(column_name)
        if column:
            db.add(Card(
                column_id=column.id,
                title=title,
                details=details,
                position=db.query(Card).filter(Card.column_id == column.id).count(),
            ))
    db.commit()
    return board


def get_board_by_id(db: Session, board_id: int) -> Board | None:
    return db.query(Board).filter(Board.id == board_id).first()


def update_board_title(db: Session, board_id: int, title: str) -> Board | None:
    board = get_board_by_id(db, board_id)
    if board:
        board.title = title
        db.commit()
        db.refresh(board)
    return board


def delete_board(db: Session, board_id: int) -> bool:
    board = get_board_by_id(db, board_id)
    if not board:
        return False
    db.delete(board)
    db.commit()
    return True


def get_columns_by_board(db: Session, board_id: int) -> list[Column]:
    return db.query(Column).filter(Column.board_id == board_id).order_by(Column.position).all()


def get_column_by_id(db: Session, column_id: int) -> Column | None:
    return db.query(Column).filter(Column.id == column_id).first()


def create_column(db: Session, board_id: int, title: str) -> Column:
    position = db.query(Column).filter(Column.board_id == board_id).count()
    col = Column(board_id=board_id, title=title, position=position)
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


def delete_column(db: Session, column_id: int) -> bool:
    col = get_column_by_id(db, column_id)
    if not col:
        return False
    board_id = col.board_id
    position = col.position
    db.delete(col)
    db.query(Column).filter(
        Column.board_id == board_id,
        Column.position > position,
    ).update({"position": Column.position - 1})
    db.commit()
    return True


def update_column(db: Session, column_id: int, title: str = None, position: int = None) -> Column | None:
    col = get_column_by_id(db, column_id)
    if not col:
        return None
    if title:
        col.title = title
    if position is not None:
        col.position = position
    db.commit()
    db.refresh(col)
    return col


def get_cards_by_column(db: Session, column_id: int) -> list[Card]:
    return db.query(Card).filter(Card.column_id == column_id).order_by(Card.position).all()


def get_card_by_id(db: Session, card_id: int) -> Card | None:
    return db.query(Card).filter(Card.id == card_id).first()


def create_card(
    db: Session,
    column_id: int,
    title: str,
    details: str = None,
    priority: str = None,
    due_date: str = None,
    color: str = None,
) -> Card:
    position = db.query(Card).filter(Card.column_id == column_id).count()
    card = Card(
        column_id=column_id,
        title=title,
        details=details,
        priority=priority,
        due_date=due_date,
        color=color,
        position=position,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def update_card(db: Session, card_id: int, updates: dict) -> Card | None:
    card = get_card_by_id(db, card_id)
    if not card:
        return None
    for field, value in updates.items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return card


def move_card(db: Session, card_id: int, column_id: int, position: int) -> Card | None:
    card = get_card_by_id(db, card_id)
    if not card:
        return None

    if card.column_id != column_id:
        db.query(Card).filter(
            Card.column_id == card.column_id,
            Card.position > card.position,
        ).update({"position": Card.position - 1})

    db.query(Card).filter(
        Card.column_id == column_id,
        Card.position >= position,
        Card.id != card_id,
    ).update({"position": Card.position + 1})

    card.column_id = column_id
    card.position = position
    db.commit()
    db.refresh(card)
    return card


def delete_card(db: Session, card_id: int) -> bool:
    card = get_card_by_id(db, card_id)
    if not card:
        return False
    column_id = card.column_id
    position = card.position
    db.delete(card)
    db.query(Card).filter(
        Card.column_id == column_id,
        Card.position > position,
    ).update({"position": Card.position - 1})
    db.commit()
    return True


def get_chat_history(db: Session, board_id: int, limit: int = 50) -> list[ChatHistory]:
    return db.query(ChatHistory).filter(
        ChatHistory.board_id == board_id
    ).order_by(desc(ChatHistory.created_at)).limit(limit).all()[::-1]


def add_chat_message(db: Session, board_id: int, role: str, content: str) -> ChatHistory:
    msg = ChatHistory(board_id=board_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
