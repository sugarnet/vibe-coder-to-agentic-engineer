"""SQLAlchemy ORM models for Kanban MVP."""
from datetime import datetime
from sqlalchemy import ForeignKey, CheckConstraint, Index, String, Text, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import List, Optional


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class User(Base):
    """User model."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    boards: Mapped[List["Board"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class Board(Base):
    """Board model."""
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), default="My Board")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_boards_user_id", "user_id"),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="boards")
    columns: Mapped[List["Column"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    chat_history: Mapped[List["ChatHistory"]] = relationship(back_populates="board", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Board(id={self.id}, user_id={self.user_id}, title={self.title})>"


class Column(Base):
    """Column model."""
    __tablename__ = "columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_columns_board_id", "board_id"),
        Index("idx_columns_board_position", "board_id", "position"),
    )

    # Relationships
    board: Mapped["Board"] = relationship(back_populates="columns")
    cards: Mapped[List["Card"]] = relationship(back_populates="column", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Column(id={self.id}, board_id={self.board_id}, title={self.title})>"


class Card(Base):
    """Card model."""
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_cards_column_id", "column_id"),
        Index("idx_cards_column_position", "column_id", "position"),
    )

    # Relationships
    column: Mapped["Column"] = relationship(back_populates="cards")

    def __repr__(self):
        return f"<Card(id={self.id}, column_id={self.column_id}, title={self.title})>"


class ChatHistory(Base):
    """Chat history model."""
    __tablename__ = "chat_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')"),
        Index("idx_chat_history_board", "board_id"),
        Index("idx_chat_history_board_created", "board_id", "created_at"),
    )

    # Relationships
    board: Mapped["Board"] = relationship(back_populates="chat_history")

    def __repr__(self):
        return f"<ChatHistory(id={self.id}, board_id={self.board_id}, role={self.role})>"
