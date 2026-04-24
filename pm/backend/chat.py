"""Chat module for AI-powered board interactions."""
import json
import re
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models import ChatHistory, Board, Column, Card
from app.schemas import BoardUpdateAction, ChatResponse
from app.crud import get_chat_history, add_chat_message
import ai


def build_ai_prompt(board_data: dict, chat_history: List[ChatHistory], user_message: str) -> str:
    """
    Build a comprehensive prompt for the AI including board state and chat history.

    Args:
        board_data: Current board state as dict
        chat_history: List of recent chat messages
        user_message: Current user message

    Returns:
        Formatted prompt string
    """
    prompt_parts = []

    # System instructions
    prompt_parts.append("""You are an AI assistant helping manage a Kanban board. You can create, move, and delete cards on the board.

Your responses should be in JSON format with two fields:
- "response": Your text reply to the user
- "board_updates": Optional array of board modification actions

Available actions:
- Create card: {"action": "create_card", "column_id": COLUMN_ID, "title": "Task title", "details": "Optional details"}
- Move card: {"action": "move_card", "card_id": CARD_ID, "target_column_id": TARGET_COLUMN_ID}
- Delete card: {"action": "delete_card", "card_id": CARD_ID}

If you don't need to modify the board, set "board_updates" to null or omit it.

Board state and chat history are provided below.""")

    # Current board state
    prompt_parts.append(f"\n=== CURRENT BOARD STATE ===\n{json.dumps(board_data, indent=2)}")

    # Recent chat history (last 10 messages)
    if chat_history:
        prompt_parts.append("\n=== RECENT CHAT HISTORY ===")
        for msg in chat_history[-10:]:  # Last 10 messages
            role_display = "User" if msg.role == "user" else "Assistant"
            prompt_parts.append(f"{role_display}: {msg.content}")

    # Current user message
    prompt_parts.append(f"\n=== CURRENT USER MESSAGE ===\n{user_message}")

    prompt_parts.append("\n=== YOUR RESPONSE ===")
    prompt_parts.append("Respond in JSON format with 'response' and optional 'board_updates' fields.")

    return "\n".join(prompt_parts)


def parse_ai_response(ai_text: str) -> ChatResponse:
    """
    Parse AI response text into structured ChatResponse.

    Args:
        ai_text: Raw AI response text

    Returns:
        Parsed ChatResponse object

    Raises:
        ValueError: If response cannot be parsed
    """
    # Try to extract JSON from the response
    json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
    if not json_match:
        # If no JSON found, treat entire response as text reply
        return ChatResponse(response=ai_text.strip(), board_updates=None)

    try:
        parsed = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in AI response: {e}")

    # Validate required fields
    if "response" not in parsed:
        raise ValueError("AI response missing required 'response' field")

    response_text = parsed["response"]
    board_updates = parsed.get("board_updates")

    # Parse board updates if present
    updates_list = None
    if board_updates:
        if not isinstance(board_updates, list):
            raise ValueError("board_updates must be an array")

        updates_list = []
        for update in board_updates:
            if not isinstance(update, dict):
                raise ValueError("Each board update must be an object")

            action = update.get("action")
            if not action:
                raise ValueError("Board update missing 'action' field")

            # Validate action types
            if action not in ["create_card", "move_card", "delete_card"]:
                raise ValueError(f"Unknown action type: {action}")

            # Create BoardUpdateAction
            board_action = BoardUpdateAction(
                action=action,
                card_id=update.get("card_id"),
                column_id=update.get("column_id"),
                target_column_id=update.get("target_column_id"),
                title=update.get("title"),
                details=update.get("details")
            )
            updates_list.append(board_action)

    return ChatResponse(response=response_text, board_updates=updates_list)


def apply_board_updates(db: Session, board_id: int, updates: List[BoardUpdateAction]) -> Dict[str, int]:
    """
    Apply board updates to the database.

    Args:
        db: Database session
        board_id: Board ID to update
        updates: List of board update actions

    Returns:
        Dict with counts of applied updates

    Raises:
        ValueError: If update validation fails
    """
    from app import crud

    counts = {"created": 0, "moved": 0, "deleted": 0}

    for update in updates:
        if update.action == "create_card":
            if not update.column_id or not update.title:
                raise ValueError("create_card requires column_id and title")

            # Verify column belongs to board
            column = crud.get_column_by_id(db, update.column_id)
            if not column or column.board_id != board_id:
                raise ValueError(f"Column {update.column_id} not found in board {board_id}")

            crud.create_card(db, update.column_id, update.title, update.details)
            counts["created"] += 1

        elif update.action == "move_card":
            if not update.card_id or not update.target_column_id:
                raise ValueError("move_card requires card_id and target_column_id")

            # Verify card exists and belongs to board
            card = crud.get_card_by_id(db, update.card_id)
            if not card:
                raise ValueError(f"Card {update.card_id} not found")

            # Verify target column belongs to board
            target_column = crud.get_column_by_id(db, update.target_column_id)
            if not target_column or target_column.board_id != board_id:
                raise ValueError(f"Target column {update.target_column_id} not found in board {board_id}")

            # Move card (this will also update position)
            crud.move_card(db, update.card_id, update.target_column_id, 999)  # High position to append
            counts["moved"] += 1

        elif update.action == "delete_card":
            if not update.card_id:
                raise ValueError("delete_card requires card_id")

            # Verify card exists and belongs to board
            card = crud.get_card_by_id(db, update.card_id)
            if not card:
                raise ValueError(f"Card {update.card_id} not found")

            # Verify card belongs to this board
            column = crud.get_column_by_id(db, card.column_id)
            if not column or column.board_id != board_id:
                raise ValueError(f"Card {update.card_id} does not belong to board {board_id}")

            crud.delete_card(db, update.card_id)
            counts["deleted"] += 1

    return counts


async def process_chat_message(
    db: Session,
    board_id: int,
    user_message: str,
    board_data: Optional[dict] = None
) -> ChatResponse:
    """
    Process a chat message with AI, including board context and updates.

    Args:
        db: Database session
        board_id: Board ID for context and updates
        user_message: User's message
        board_data: Optional current board state (if not provided, will be fetched)

    Returns:
        AI response with optional board updates
    """
    # Get board data if not provided
    if board_data is None:
        from app.crud import get_board_by_id
        board = get_board_by_id(db, board_id)
        if not board:
            raise ValueError(f"Board {board_id} not found")

        # Convert to dict for prompt building
        board_data = {
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
                            "position": card.position
                        } for card in col.cards
                    ]
                } for col in board.columns
            ]
        }

    # Get recent chat history
    chat_history = get_chat_history(db, board_id, limit=10)

    # Build AI prompt
    prompt = build_ai_prompt(board_data, chat_history, user_message)

    # Call AI
    ai_response_text = await ai.call_ai(prompt)

    # Parse structured response
    try:
        structured_response = parse_ai_response(ai_response_text)
    except ValueError as e:
        # If parsing fails, return the raw response as text-only
        structured_response = ChatResponse(
            response=f"I encountered an error processing your request: {e}\n\nRaw response: {ai_response_text}",
            board_updates=None
        )

    # Apply board updates if present
    if structured_response.board_updates:
        try:
            update_counts = apply_board_updates(db, board_id, structured_response.board_updates)
            # Add update summary to response
            update_summary = []
            if update_counts["created"] > 0:
                update_summary.append(f"Created {update_counts['created']} card(s)")
            if update_counts["moved"] > 0:
                update_summary.append(f"Moved {update_counts['moved']} card(s)")
            if update_counts["deleted"] > 0:
                update_summary.append(f"Deleted {update_counts['deleted']} card(s)")

            if update_summary:
                structured_response.response += f"\n\nBoard updates applied: {', '.join(update_summary)}"
        except ValueError as e:
            # If board updates fail, add error to response but keep the text response
            structured_response.response += f"\n\nWarning: Could not apply board updates: {e}"
            structured_response.board_updates = None  # Clear failed updates

    # Save messages to chat history
    add_chat_message(db, board_id, "user", user_message)
    add_chat_message(db, board_id, "assistant", structured_response.response)

    return structured_response