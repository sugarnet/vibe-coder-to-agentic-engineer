"""Pydantic schemas for API validation and serialization."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, computed_field


# Card schemas
class CardBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    details: Optional[str] = None


class CardCreate(CardBase):
    column_id: int


class CardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    details: Optional[str] = None


class CardResponse(CardBase):
    id: int
    column_id: int
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Column schemas
class ColumnBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class ColumnCreate(ColumnBase):
    pass


class ColumnUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    position: Optional[int] = None


class ColumnResponse(ColumnBase):
    id: int
    position: int
    cards: List[CardResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# Board schemas
class BoardResponse(BaseModel):
    id: int
    title: str
    user_id: int
    columns: List[ColumnResponse] = []
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def cards(self) -> List[CardResponse]:
        """Flatten all cards from all columns into a single array."""
        all_cards: List[CardResponse] = []
        for column in self.columns:
            all_cards.extend(column.cards)
        return all_cards

    class Config:
        from_attributes = True


# Board update schema (bulk update for drag-drop)
class CardUpdateInBoard(BaseModel):
    id: int
    column_id: int
    position: int


class ColumnUpdateInBoard(BaseModel):
    id: int
    title: str
    position: int


class BoardUpdate(BaseModel):
    columns: List[ColumnUpdateInBoard]
    cards: List[CardUpdateInBoard]


class BoardUpdateResponse(BaseModel):
    success: bool
    board_id: int
    columns_updated: int
    cards_updated: int


# User schemas
class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


# Login schemas (already defined, but with Pydantic v2 syntax)
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    token: str
    user_id: int


# Chat schemas
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatHistoryResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    board_updates: Optional[dict] = None


# AI test schemas
class AITestRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class AITestResponse(BaseModel):
    prompt: str
    response: str
    status: str = "success"
