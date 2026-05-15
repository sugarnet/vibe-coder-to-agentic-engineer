import json
import re
from typing import List, Optional
from sqlalchemy.orm import Session

import ai
from app import crud
from app.crud import add_chat_message, get_chat_history
from app.models import ChatHistory
from app.schemas import BoardUpdateAction, ChatResponse


SYSTEM_INSTRUCTIONS = """You are an AI assistant helping manage a Kanban board. You can create, move, and delete cards on the board.

Your responses should be in JSON format with two fields:
- "response": Your text reply to the user
- "board_updates": Optional array of board modification actions

Available actions:
- Create card: {"action": "create_card", "column_id": COLUMN_ID, "title": "Task title", "details": "Optional details"}
- Move card: {"action": "move_card", "card_id": CARD_ID, "target_column_id": TARGET_COLUMN_ID}
- Delete card: {"action": "delete_card", "card_id": CARD_ID}

If you don't need to modify the board, set "board_updates" to null or omit it.

Board state and chat history are provided below."""

VALID_ACTIONS = {"create_card", "move_card", "delete_card"}


def build_ai_prompt(board_data: dict, chat_history: List[ChatHistory], user_message: str) -> str:
    parts = [
        SYSTEM_INSTRUCTIONS,
        f"\n=== CURRENT BOARD STATE ===\n{json.dumps(board_data, indent=2)}",
    ]

    if chat_history:
        parts.append("\n=== RECENT CHAT HISTORY ===")
        for msg in chat_history[-10:]:
            role = "User" if msg.role == "user" else "Assistant"
            parts.append(f"{role}: {msg.content}")

    parts.append(f"\n=== CURRENT USER MESSAGE ===\n{user_message}")
    parts.append("\n=== YOUR RESPONSE ===")
    parts.append("Respond in JSON format with 'response' and optional 'board_updates' fields.")
    return "\n".join(parts)


def parse_ai_response(ai_text: str) -> ChatResponse:
    json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
    if not json_match:
        return ChatResponse(response=ai_text.strip(), board_updates=None)

    try:
        parsed = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in AI response: {e}")

    if "response" not in parsed:
        raise ValueError("AI response missing required 'response' field")

    board_updates = parsed.get("board_updates")
    if not board_updates:
        return ChatResponse(response=parsed["response"], board_updates=None)

    if not isinstance(board_updates, list):
        raise ValueError("board_updates must be an array")

    updates = []
    for update in board_updates:
        if not isinstance(update, dict):
            raise ValueError("Each board update must be an object")
        action = update.get("action")
        if not action:
            raise ValueError("Board update missing 'action' field")
        if action not in VALID_ACTIONS:
            raise ValueError(f"Unknown action type: {action}")
        updates.append(BoardUpdateAction(
            action=action,
            card_id=update.get("card_id"),
            column_id=update.get("column_id"),
            target_column_id=update.get("target_column_id"),
            title=update.get("title"),
            details=update.get("details"),
        ))

    return ChatResponse(response=parsed["response"], board_updates=updates)


def apply_board_updates(db: Session, board_id: int, updates: List[BoardUpdateAction]) -> dict:
    counts = {"created": 0, "moved": 0, "deleted": 0}

    for update in updates:
        if update.action == "create_card":
            if not update.column_id or not update.title:
                raise ValueError("create_card requires column_id and title")
            column = crud.get_column_by_id(db, update.column_id)
            if not column or column.board_id != board_id:
                raise ValueError(f"Column {update.column_id} not found in board {board_id}")
            crud.create_card(db, update.column_id, update.title, update.details)
            counts["created"] += 1

        elif update.action == "move_card":
            if not update.card_id or not update.target_column_id:
                raise ValueError("move_card requires card_id and target_column_id")
            card = crud.get_card_by_id(db, update.card_id)
            if not card:
                raise ValueError(f"Card {update.card_id} not found")
            target = crud.get_column_by_id(db, update.target_column_id)
            if not target or target.board_id != board_id:
                raise ValueError(f"Target column {update.target_column_id} not found in board {board_id}")
            crud.move_card(db, update.card_id, update.target_column_id, 999)
            counts["moved"] += 1

        elif update.action == "delete_card":
            if not update.card_id:
                raise ValueError("delete_card requires card_id")
            card = crud.get_card_by_id(db, update.card_id)
            if not card:
                raise ValueError(f"Card {update.card_id} not found")
            column = crud.get_column_by_id(db, card.column_id)
            if not column or column.board_id != board_id:
                raise ValueError(f"Card {update.card_id} does not belong to board {board_id}")
            crud.delete_card(db, update.card_id)
            counts["deleted"] += 1

    return counts


def _serialize_board(board) -> dict:
    return {
        "id": board.id,
        "title": board.title,
        "columns": [
            {
                "id": col.id,
                "title": col.title,
                "position": col.position,
                "cards": [
                    {
                        "id": card.id,
                        "title": card.title,
                        "details": card.details,
                        "position": card.position,
                    }
                    for card in col.cards
                ],
            }
            for col in board.columns
        ],
    }


async def process_chat_message(
    db: Session,
    board_id: int,
    user_message: str,
    board_data: Optional[dict] = None,
) -> ChatResponse:
    if board_data is None:
        board = crud.get_board_by_id(db, board_id)
        if not board:
            raise ValueError(f"Board {board_id} not found")
        board_data = _serialize_board(board)

    history = get_chat_history(db, board_id, limit=10)
    prompt = build_ai_prompt(board_data, history, user_message)
    ai_response_text = await ai.call_ai(prompt)

    try:
        response = parse_ai_response(ai_response_text)
    except ValueError as e:
        response = ChatResponse(
            response=f"I encountered an error processing your request: {e}\n\nRaw response: {ai_response_text}",
            board_updates=None,
        )

    if response.board_updates:
        try:
            counts = apply_board_updates(db, board_id, response.board_updates)
            summary = []
            if counts["created"]:
                summary.append(f"Created {counts['created']} card(s)")
            if counts["moved"]:
                summary.append(f"Moved {counts['moved']} card(s)")
            if counts["deleted"]:
                summary.append(f"Deleted {counts['deleted']} card(s)")
            if summary:
                response.response += f"\n\nBoard updates applied: {', '.join(summary)}"
        except ValueError as e:
            response.response += f"\n\nWarning: Could not apply board updates: {e}"
            response.board_updates = None

    add_chat_message(db, board_id, "user", user_message)
    add_chat_message(db, board_id, "assistant", response.response)
    return response
