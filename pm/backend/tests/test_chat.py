from unittest.mock import MagicMock, patch

import pytest

import chat


MOCK_AI_TEXT_RESPONSE = '{"response": "Hello from AI", "board_updates": null}'


def _login(client, username: str = "user", password: str = "password") -> str:
    response = client.post("/api/login", json={"username": username, "password": password})
    return response.json()["token"]


class TestChatModule:
    def test_build_ai_prompt_basic(self):
        board_data = {
            "id": 1,
            "title": "Test Board",
            "columns": [{
                "id": 1, "title": "To Do", "position": 0,
                "cards": [{"id": 1, "title": "Task 1", "details": None, "position": 0}],
            }],
        }
        prompt = chat.build_ai_prompt(board_data, [], "Create a new task")

        assert "You are an AI assistant" in prompt
        assert "Test Board" in prompt
        assert "Create a new task" in prompt
        assert "Available actions:" in prompt
        assert "create_card" in prompt

    def test_build_ai_prompt_with_history(self):
        history = [
            MagicMock(role="user", content="Hello"),
            MagicMock(role="assistant", content="Hi there!"),
        ]
        prompt = chat.build_ai_prompt({"id": 1, "title": "Board", "columns": []}, history, "How are you?")

        assert "User: Hello" in prompt
        assert "Assistant: Hi there!" in prompt
        assert "How are you?" in prompt

    def test_parse_ai_response_text_only(self):
        response = chat.parse_ai_response("This is just a text response without JSON.")
        assert response.response == "This is just a text response without JSON."
        assert response.board_updates is None

    def test_parse_ai_response_with_json(self):
        ai_text = '''Here is my response:
        {
            "response": "I created a new task for you",
            "board_updates": [
                {"action": "create_card", "column_id": 1, "title": "New Task", "details": "Task details"}
            ]
        }'''
        response = chat.parse_ai_response(ai_text)

        assert response.response == "I created a new task for you"
        assert len(response.board_updates) == 1
        update = response.board_updates[0]
        assert update.action == "create_card"
        assert update.column_id == 1
        assert update.title == "New Task"
        assert update.details == "Task details"

    def test_parse_ai_response_invalid_json(self):
        with pytest.raises(ValueError, match="Invalid JSON"):
            chat.parse_ai_response('{"response": "test", "invalid": json}')

    def test_parse_ai_response_missing_response_field(self):
        with pytest.raises(ValueError, match="missing required 'response' field"):
            chat.parse_ai_response('{"board_updates": []}')

    def test_parse_ai_response_invalid_action(self):
        ai_text = '{"response": "test", "board_updates": [{"action": "invalid_action"}]}'
        with pytest.raises(ValueError, match="Unknown action type"):
            chat.parse_ai_response(ai_text)

    @pytest.mark.asyncio
    async def test_process_chat_message_basic(self):
        mock_db = MagicMock()
        board_data = {"id": 1, "title": "Test Board", "columns": []}
        ai_text = '{"response": "Hello! How can I help you with your board?", "board_updates": null}'

        with patch("chat.get_chat_history", return_value=[]), \
             patch("ai.call_ai", return_value=ai_text), \
             patch("chat.add_chat_message") as mock_add_message:

            response = await chat.process_chat_message(
                db=mock_db, board_id=1, user_message="Hello", board_data=board_data,
            )

            assert response.response == "Hello! How can I help you with your board?"
            assert response.board_updates is None
            assert mock_add_message.call_count == 2
            mock_add_message.assert_any_call(mock_db, 1, "user", "Hello")
            mock_add_message.assert_any_call(mock_db, 1, "assistant", response.response)


class TestChatEndpoint:
    def test_chat_endpoint_requires_auth(self, client):
        response = client.post("/api/chat", json={"message": "Hello"})
        assert response.status_code == 403

    def test_chat_endpoint_with_mock_ai(self, client):
        token = _login(client)
        ai_text = '''{
            "response": "I understand you want to manage your board.",
            "board_updates": [
                {"action": "create_card", "column_id": 1, "title": "Test Task", "details": "Created via chat"}
            ]
        }'''
        with patch("ai.call_ai", return_value=ai_text):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Create a task for me"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert len(data["board_updates"]) == 1

    def test_get_chat_history_endpoint(self, client):
        token = _login(client)
        headers = {"Authorization": f"Bearer {token}"}

        with patch("ai.call_ai", return_value=MOCK_AI_TEXT_RESPONSE):
            send = client.post("/api/chat", headers=headers, json={"message": "Hello AI"})
            assert send.status_code == 200

        history_response = client.get("/api/chat/history", headers=headers)
        assert history_response.status_code == 200
        history = history_response.json()
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello AI"
        assert history[1]["role"] == "assistant"
        assert history[1]["content"] == "Hello from AI"

    def test_chat_endpoint_ai_error_handling(self, client):
        token = _login(client)
        with patch("ai.call_ai", side_effect=Exception("AI service unavailable")):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Hello"},
            )
            assert response.status_code == 500
            assert "error" in response.json()["detail"].lower()

    def test_chat_endpoint_invalid_board_updates(self, client):
        token = _login(client)
        ai_text = '''{
            "response": "Trying to create a card",
            "board_updates": [{"action": "create_card", "column_id": 999, "title": "Invalid Column"}]
        }'''
        with patch("ai.call_ai", return_value=ai_text):
            response = client.post(
                "/api/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Create a task"},
            )
            assert response.status_code == 200
            assert "Warning: Could not apply board updates" in response.json()["response"]
