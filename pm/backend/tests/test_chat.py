"""Unit and integration tests for chat functionality (Part 9)."""
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, Engine
import sqlite3
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db
from app.models import Base
import chat
from app.schemas import ChatResponse, BoardUpdateAction


# ============= Fixtures =============

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory database for each test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )

    # Enable foreign keys
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        if isinstance(dbapi_conn, sqlite3.Connection):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    Base.metadata.create_all(bind=engine)

    SessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(test_db):
    """Create test client with test database."""
    return TestClient(app)


# ============= Unit Tests for chat.py =============

class TestChatModule:
    """Unit tests for chat module."""

    def test_build_ai_prompt_basic(self):
        """build_ai_prompt should create a comprehensive prompt."""
        board_data = {
            "id": 1,
            "title": "Test Board",
            "columns": [
                {
                    "id": 1,
                    "title": "To Do",
                    "position": 0,
                    "cards": [
                        {"id": 1, "title": "Task 1", "details": None, "position": 0}
                    ]
                }
            ]
        }

        chat_history = []
        user_message = "Create a new task"

        prompt = chat.build_ai_prompt(board_data, chat_history, user_message)

        assert "You are an AI assistant" in prompt
        assert "Test Board" in prompt
        assert "Create a new task" in prompt
        assert "Available actions:" in prompt
        assert "create_card" in prompt

    def test_build_ai_prompt_with_history(self):
        """build_ai_prompt should include chat history."""
        board_data = {"id": 1, "title": "Board", "columns": []}
        chat_history = [
            MagicMock(role="user", content="Hello"),
            MagicMock(role="assistant", content="Hi there!")
        ]
        user_message = "How are you?"

        prompt = chat.build_ai_prompt(board_data, chat_history, user_message)

        assert "User: Hello" in prompt
        assert "Assistant: Hi there!" in prompt
        assert "How are you?" in prompt

    def test_parse_ai_response_text_only(self):
        """parse_ai_response should handle text-only responses."""
        ai_text = "This is just a text response without JSON."

        response = chat.parse_ai_response(ai_text)

        assert response.response == ai_text
        assert response.board_updates is None

    def test_parse_ai_response_with_json(self):
        """parse_ai_response should parse JSON responses correctly."""
        ai_text = '''Here is my response:
        {
            "response": "I created a new task for you",
            "board_updates": [
                {
                    "action": "create_card",
                    "column_id": 1,
                    "title": "New Task",
                    "details": "Task details"
                }
            ]
        }
        '''

        response = chat.parse_ai_response(ai_text)

        assert response.response == "I created a new task for you"
        assert len(response.board_updates) == 1
        update = response.board_updates[0]
        assert update.action == "create_card"
        assert update.column_id == 1
        assert update.title == "New Task"
        assert update.details == "Task details"

    def test_parse_ai_response_invalid_json(self):
        """parse_ai_response should raise ValueError for invalid JSON."""
        ai_text = '{"response": "test", "invalid": json}'

        with pytest.raises(ValueError, match="Invalid JSON"):
            chat.parse_ai_response(ai_text)

    def test_parse_ai_response_missing_response_field(self):
        """parse_ai_response should raise ValueError for missing response field."""
        ai_text = '{"board_updates": []}'

        with pytest.raises(ValueError, match="missing required 'response' field"):
            chat.parse_ai_response(ai_text)

    def test_parse_ai_response_invalid_action(self):
        """parse_ai_response should raise ValueError for invalid actions."""
        ai_text = '''{
            "response": "test",
            "board_updates": [{"action": "invalid_action"}]
        }'''

        with pytest.raises(ValueError, match="Unknown action type"):
            chat.parse_ai_response(ai_text)

    @pytest.mark.asyncio
    async def test_process_chat_message_basic(self):
        """process_chat_message should handle basic chat flow."""
        # Mock database session
        mock_db = MagicMock()

        # Mock board data
        board_data = {"id": 1, "title": "Test Board", "columns": []}

        # Mock AI response
        mock_ai_response = '''{
            "response": "Hello! How can I help you with your board?",
            "board_updates": null
        }'''

        with patch("chat.get_chat_history", return_value=[]), \
             patch("ai.call_ai", return_value=mock_ai_response), \
             patch("chat.add_chat_message") as mock_add_message:

            response = await chat.process_chat_message(
                db=mock_db,
                board_id=1,
                user_message="Hello",
                board_data=board_data
            )

            assert response.response == "Hello! How can I help you with your board?"
            assert response.board_updates is None

            # Verify messages were saved
            assert mock_add_message.call_count == 2
            mock_add_message.assert_any_call(mock_db, 1, "user", "Hello")
            mock_add_message.assert_any_call(mock_db, 1, "assistant", response.response)


# ============= Integration Tests for /api/chat endpoint =============

class TestChatEndpoint:
    """Integration tests for /api/chat endpoint."""

    def test_chat_endpoint_requires_auth(self, client):
        """POST /api/chat should require authentication."""
        response = client.post(
            "/api/chat",
            json={"message": "Hello"}
        )

        assert response.status_code == 403

    def test_chat_endpoint_with_mock_ai(self, client):
        """POST /api/chat should process chat with AI."""
        # First login to get token
        login_response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = login_response.json()["token"]

        # Mock AI response
        mock_ai_response = '''{
            "response": "I understand you want to manage your board.",
            "board_updates": [
                {
                    "action": "create_card",
                    "column_id": 1,
                    "title": "Test Task",
                    "details": "Created via chat"
                }
            ]
        }'''

        with patch("ai.call_ai", return_value=mock_ai_response):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Create a task for me"}
            )

            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert "board_updates" in data
            assert len(data["board_updates"]) == 1

    def test_get_chat_history_endpoint(self, client):
        """GET /api/chat/history should return the saved chat history."""
        login_response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = login_response.json()["token"]

        mock_ai_response = '''{
            "response": "Hello from AI",
            "board_updates": null
        }'''

        with patch("ai.call_ai", return_value=mock_ai_response):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Hello AI"}
            )
            assert response.status_code == 200

        history_response = client.get(
            "/api/chat/history",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert history_response.status_code == 200
        history_data = history_response.json()
        assert isinstance(history_data, list)
        assert len(history_data) == 2
        assert history_data[0]["role"] == "user"
        assert history_data[1]["role"] == "assistant"
        assert history_data[0]["content"] == "Hello AI"
        assert history_data[1]["content"] == "Hello from AI"

    def test_chat_endpoint_ai_error_handling(self, client):
        """POST /api/chat should handle AI errors gracefully."""
        # First login
        login_response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = login_response.json()["token"]

        # Mock AI error
        with patch("ai.call_ai", side_effect=Exception("AI service unavailable")):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Hello"}
            )

            assert response.status_code == 500
            data = response.json()
            assert "error" in data["detail"].lower()

    def test_chat_endpoint_invalid_board_updates(self, client):
        """POST /api/chat should handle invalid board updates."""
        # First login
        login_response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = login_response.json()["token"]

        # Mock AI response with invalid board update
        mock_ai_response = '''{
            "response": "Trying to create a card",
            "board_updates": [
                {
                    "action": "create_card",
                    "column_id": 999,
                    "title": "Invalid Column"
                }
            ]
        }'''

        with patch("ai.call_ai", return_value=mock_ai_response):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Create a task"}
            )

            assert response.status_code == 200
            data = response.json()
            # Should still return response but with error message about board updates
            assert "Warning: Could not apply board updates" in data["response"]