from datetime import datetime
from typing import List, Optional
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    boards: Mapped[List["Board"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), default="My Board")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index("idx_boards_user_id", "user_id"),)

    user: Mapped["User"] = relationship(back_populates="boards")
    columns: Mapped[List["Column"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    chat_history: Mapped[List["ChatHistory"]] = relationship(back_populates="board", cascade="all, delete-orphan")


class Column(Base):
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

    board: Mapped["Board"] = relationship(back_populates="columns")
    cards: Mapped[List["Card"]] = relationship(back_populates="column", cascade="all, delete-orphan")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("priority IN ('low', 'medium', 'high') OR priority IS NULL", name="ck_card_priority"),
        Index("idx_cards_column_id", "column_id"),
        Index("idx_cards_column_position", "column_id", "position"),
    )

    column: Mapped["Column"] = relationship(back_populates="cards")


class ChatHistory(Base):
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

    board: Mapped["Board"] = relationship(back_populates="chat_history")
