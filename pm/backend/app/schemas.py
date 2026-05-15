from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, computed_field


class CardBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    details: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    due_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    color: Optional[str] = Field(None, max_length=20)


class CardCreate(CardBase):
    column_id: int


class CardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    details: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    due_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    color: Optional[str] = Field(None, max_length=20)


class CardResponse(CardBase):
    id: int
    column_id: int
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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


class BoardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


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
        return [card for column in self.columns for card in column.cards]

    class Config:
        from_attributes = True


class BoardSummary(BaseModel):
    id: int
    title: str
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=6, max_length=100)


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    token: str
    user_id: int


class RegisterResponse(BaseModel):
    username: str
    token: str
    user_id: int


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatHistoryResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    board_state: Optional[dict] = None
    board_id: Optional[int] = None


class BoardUpdateAction(BaseModel):
    action: str
    card_id: Optional[int] = None
    column_id: Optional[int] = None
    target_column_id: Optional[int] = None
    title: Optional[str] = None
    details: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    board_updates: Optional[List[BoardUpdateAction]] = None


class AITestRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class AITestResponse(BaseModel):
    prompt: str
    response: str
    status: str = "success"
