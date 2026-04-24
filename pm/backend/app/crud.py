"""CRUD operations for database models."""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import User, Board, Column, Card, ChatHistory


# User operations
def get_or_create_user(db: Session, username: str) -> User:
    """Get user by username or create if doesn't exist."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """Get user by username."""
    return db.query(User).filter(User.username == username).first()


# Board operations
def get_or_create_user_board(db: Session, user_id: int) -> Board:
    """Get user's board (MVP: one board per user). Create if missing."""
    board = db.query(Board).filter(Board.user_id == user_id).first()
    if not board:
        board = Board(user_id=user_id, title="My Board")
        db.add(board)
        db.commit()
        db.refresh(board)
        # Create default columns
        default_columns = ["To Do", "In Progress", "Review", "Done", "Backlog"]
        columns = []
        for idx, col_title in enumerate(default_columns):
            col = Column(board_id=board.id, title=col_title, position=idx)
            db.add(col)
            columns.append(col)
        db.commit()
        db.refresh(board)

        # Create default cards for the new board
        default_cards = [
            ("To Do", "Define MVP scope", "Clarify the first deliverables and timeline."),
            ("In Progress", "Build login flow", "Implement auth and user session handling."),
            ("Review", "Review board layout", "Check mobile and desktop layout for the Kanban board."),
            ("Done", "Setup basic project structure", "Initial backend, frontend, and database scaffolding."),
            ("Backlog", "Collect feature ideas", "Add any future ideas for the board and AI assistant."),
        ]

        for column_name, title, details in default_cards:
            column = next((col for col in columns if col.title == column_name), None)
            if column:
                card = Card(column_id=column.id, title=title, details=details, position=db.query(Card).filter(Card.column_id == column.id).count())
                db.add(card)
        db.commit()
    return board


def get_board_by_id(db: Session, board_id: int) -> Board | None:
    """Get board by ID."""
    return db.query(Board).filter(Board.id == board_id).first()


def update_board_title(db: Session, board_id: int, title: str) -> Board:
    """Update board title."""
    board = db.query(Board).filter(Board.id == board_id).first()
    if board:
        board.title = title
        db.commit()
        db.refresh(board)
    return board


# Column operations
def get_columns_by_board(db: Session, board_id: int) -> list[Column]:
    """Get all columns for a board, sorted by position."""
    return db.query(Column).filter(Column.board_id == board_id).order_by(Column.position).all()


def get_column_by_id(db: Session, column_id: int) -> Column | None:
    """Get column by ID."""
    return db.query(Column).filter(Column.id == column_id).first()


def update_column(db: Session, column_id: int, title: str = None, position: int = None) -> Column:
    """Update column title and/or position."""
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
    """Get all cards in a column, sorted by position."""
    return db.query(Card).filter(Card.column_id == column_id).order_by(Card.position).all()


def get_card_by_id(db: Session, card_id: int) -> Card | None:
    """Get card by ID."""
    return db.query(Card).filter(Card.id == card_id).first()


def create_card(db: Session, column_id: int, title: str, details: str = None) -> Card:
    """Create a new card."""
    # Get next position
    max_position = db.query(Card).filter(Card.column_id == column_id).count()
    card = Card(column_id=column_id, title=title, details=details, position=max_position)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def update_card(db: Session, card_id: int, title: str = None, details: str = None) -> Card | None:
    """Update card title and/or details."""
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        if title:
            card.title = title
        if details is not None:
            card.details = details
        db.commit()
        db.refresh(card)
    return card


def move_card(db: Session, card_id: int, column_id: int, position: int) -> Card | None:
    """Move card to different column and position."""
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        old_column_id = card.column_id
        
        # If moving to different column, shift positions in old column
        if old_column_id != column_id:
            db.query(Card).filter(
                Card.column_id == old_column_id,
                Card.position > card.position
            ).update({"position": Card.position - 1})
        
        # Shift positions in target column to make room
        db.query(Card).filter(
            Card.column_id == column_id,
            Card.position >= position,
            Card.id != card_id
        ).update({"position": Card.position + 1})
        
        # Update card
        card.column_id = column_id
        card.position = position
        db.commit()
        db.refresh(card)
    return card


def delete_card(db: Session, card_id: int) -> bool:
    """Delete a card and reorder remaining cards."""
    card = db.query(Card).filter(Card.id == card_id).first()
    if card:
        column_id = card.column_id
        position = card.position
        
        # Delete the card
        db.delete(card)
        
        # Reorder remaining cards in the column
        db.query(Card).filter(
            Card.column_id == column_id,
            Card.position > position
        ).update({"position": Card.position - 1})
        
        db.commit()
        return True
    return False


# Chat operations
def get_chat_history(db: Session, board_id: int, limit: int = 50) -> list[ChatHistory]:
    """Get recent chat messages for a board."""
    return db.query(ChatHistory).filter(
        ChatHistory.board_id == board_id
    ).order_by(desc(ChatHistory.created_at)).limit(limit).all()[::-1]


def add_chat_message(db: Session, board_id: int, role: str, content: str) -> ChatHistory:
    """Add a message to chat history."""
    msg = ChatHistory(board_id=board_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
