"""CRUD operations for database models."""
import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import User, Board, Column, Card, ChatHistory


# User operations
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_user(db: Session, username: str, password: str) -> User:
    """Create a new user with hashed password."""
    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_user(db: Session, username: str, password: str | None = None) -> User:
    """Get user by username or create if doesn't exist (for seeding)."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash=hash_password(password) if password else None
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
    """Verify credentials. Returns user on success, None on failure."""
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_all_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.created_at).all()


# Board operations
def list_user_boards(db: Session, user_id: int) -> list[Board]:
    """List all boards for a user, ordered by creation date."""
    return db.query(Board).filter(Board.user_id == user_id).order_by(Board.created_at).all()


def create_board(db: Session, user_id: int, title: str) -> Board:
    """Create a new board with default columns."""
    board = Board(user_id=user_id, title=title)
    db.add(board)
    db.commit()
    db.refresh(board)

    default_columns = ["To Do", "In Progress", "Review", "Done", "Backlog"]
    for idx, col_title in enumerate(default_columns):
        col = Column(board_id=board.id, title=col_title, position=idx)
        db.add(col)
    db.commit()
    db.refresh(board)
    return board


def get_or_create_user_board(db: Session, user_id: int) -> Board:
    """Get user's first board or create one if none exist."""
    board = db.query(Board).filter(Board.user_id == user_id).order_by(Board.created_at).first()
    if not board:
        board = create_board(db, user_id, "My Board")
        db.refresh(board)

        # Create default cards
        default_cards = [
            ("To Do", "Define MVP scope", "Clarify the first deliverables and timeline."),
            ("In Progress", "Build login flow", "Implement auth and user session handling."),
            ("Review", "Review board layout", "Check mobile and desktop layout for the Kanban board."),
            ("Done", "Setup basic project structure", "Initial backend, frontend, and database scaffolding."),
            ("Backlog", "Collect feature ideas", "Add any future ideas for the board and AI assistant."),
        ]
        columns = db.query(Column).filter(Column.board_id == board.id).all()
        for column_name, title, details in default_cards:
            column = next((col for col in columns if col.title == column_name), None)
            if column:
                card = Card(
                    column_id=column.id,
                    title=title,
                    details=details,
                    position=db.query(Card).filter(Card.column_id == column.id).count()
                )
                db.add(card)
        db.commit()
    return board


def get_board_by_id(db: Session, board_id: int) -> Board | None:
    return db.query(Board).filter(Board.id == board_id).first()


def update_board_title(db: Session, board_id: int, title: str) -> Board | None:
    board = db.query(Board).filter(Board.id == board_id).first()
    if board:
        board.title = title
        db.commit()
        db.refresh(board)
    return board


def delete_board(db: Session, board_id: int) -> bool:
    board = db.query(Board).filter(Board.id == board_id).first()
    if board:
        db.delete(board)
        db.commit()
        return True
    return False


# Column operations
def get_columns_by_board(db: Session, board_id: int) -> list[Column]:
    return db.query(Column).filter(Column.board_id == board_id).order_by(Column.position).all()


def get_column_by_id(db: Session, column_id: int) -> Column | None:
    return db.query(Column).filter(Column.id == column_id).first()


def create_column(db: Session, board_id: int, title: str) -> Column:
    """Add a new column to a board at the end."""
    max_pos = db.query(Column).filter(Column.board_id == board_id).count()
    col = Column(board_id=board_id, title=title, position=max_pos)
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


def delete_column(db: Session, column_id: int) -> bool:
    """Delete a column and reorder remaining columns."""
    col = db.query(Column).filter(Column.id == column_id).first()
    if col:
        board_id = col.board_id
        position = col.position
        db.delete(col)
        # Reorder remaining columns
        db.query(Column).filter(
            Column.board_id == board_id,
            Column.position > position
        ).update({"position": Column.position - 1})
        db.commit()
        return True
    return False


def update_column(db: Session, column_id: int, title: str = None, position: int = None) -> Column | None:
    col = db.query(Column).filter(Column.id == column_id).first()
    if col:
        if title:
            col.title = title
        if position is not None:
            col.position = position
        db.commit()
        db.refresh(col)
    return col


# Card operations
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
    max_position = db.query(Card).filter(Card.column_id == column_id).count()
    card = Card(
        column_id=column_id,
        title=title,
        details=details,
        priority=priority,
        due_date=due_date,
        color=color,
        position=max_position,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def update_card(db: Session, card_id: int, updates: dict) -> Card | None:
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        for field, value in updates.items():
            setattr(card, field, value)
        db.commit()
        db.refresh(card)
    return card


def move_card(db: Session, card_id: int, column_id: int, position: int) -> Card | None:
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        old_column_id = card.column_id

        if old_column_id != column_id:
            db.query(Card).filter(
                Card.column_id == old_column_id,
                Card.position > card.position
            ).update({"position": Card.position - 1})

        db.query(Card).filter(
            Card.column_id == column_id,
            Card.position >= position,
            Card.id != card_id
        ).update({"position": Card.position + 1})

        card.column_id = column_id
        card.position = position
        db.commit()
        db.refresh(card)
    return card


def delete_card(db: Session, card_id: int) -> bool:
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        column_id = card.column_id
        position = card.position

        db.delete(card)

        db.query(Card).filter(
            Card.column_id == column_id,
            Card.position > position
        ).update({"position": Card.position - 1})

        db.commit()
        return True
    return False


# Chat operations
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
