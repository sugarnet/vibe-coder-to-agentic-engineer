import os
from unittest.mock import MagicMock, patch

import pytest

import ai


def _mock_chat_response(content: str = "4") -> MagicMock:
    mock = MagicMock()
    mock.choices = [MagicMock(message=MagicMock(content=content))]
    return mock


def _mock_openai(monkeypatch_target: str = "ai.OpenAI"):
    """Patch ai.OpenAI and return a MagicMock instance whose
    .chat.completions.create can be configured by the caller."""
    return patch(monkeypatch_target)


class TestAIModule:
    def test_get_ai_client_with_valid_key(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            client = ai.get_ai_client()
            assert client.api_key == "test-key"

    def test_get_ai_client_without_api_key(self):
        with patch.dict(os.environ, {}, clear=True), pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
            ai.get_ai_client()

    @pytest.mark.asyncio
    async def test_call_ai_with_valid_prompt(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = _mock_chat_response("4")
            assert await ai.call_ai("What is 2+2?") == "4"

    @pytest.mark.asyncio
    async def test_call_ai_with_empty_prompt(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), pytest.raises(ValueError, match="empty"):
            await ai.call_ai("")

    @pytest.mark.asyncio
    async def test_call_ai_with_empty_response(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = _mock_chat_response("")
            with pytest.raises(ValueError, match="empty"):
                await ai.call_ai("What is 2+2?")

    @pytest.mark.asyncio
    async def test_call_ai_with_no_choices(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            response = MagicMock()
            response.choices = []
            mock_openai.return_value.chat.completions.create.return_value = response
            with pytest.raises(ValueError, match="no response"):
                await ai.call_ai("What is 2+2?")

    @pytest.mark.asyncio
    async def test_call_ai_timeout(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.side_effect = TimeoutError("Request timed out")
            with pytest.raises(TimeoutError):
                await ai.call_ai("What is 2+2?", timeout=15)

    @pytest.mark.asyncio
    async def test_call_ai_without_api_key(self):
        with patch.dict(os.environ, {}, clear=True), pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
            await ai.call_ai("What is 2+2?")


class TestAIEndpoint:
    def test_ai_test_endpoint_with_mock_response(self, client):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = _mock_chat_response("4")
            response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})
            assert response.status_code == 200
            data = response.json()
            assert data["prompt"] == "What is 2+2?"
            assert data["response"] == "4"
            assert data["status"] == "success"

    def test_ai_test_endpoint_missing_api_key(self, client):
        with patch.dict(os.environ, {}, clear=True):
            response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})
            assert response.status_code == 500
            assert "configuration" in response.json()["detail"].lower()

    def test_ai_test_endpoint_timeout(self, client):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.side_effect = TimeoutError("Timeout")
            response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})
            assert response.status_code == 503
            assert "timeout" in response.json()["detail"].lower()

    def test_ai_test_endpoint_empty_response(self, client):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch("ai.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = _mock_chat_response("")
            response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})
            assert response.status_code == 500
            assert "error" in response.json()["detail"].lower()

    def test_ai_test_endpoint_with_real_api_if_key_available(self, client):
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key or not api_key.startswith("sk-or-v1-"):
            pytest.skip("OPENROUTER_API_KEY not set or invalid format")

        response = client.post("/api/ai/test", json={"prompt": "What is 2+2? Answer with just the number."})
        assert response.status_code in [200, 500, 503]
        if response.status_code == 200:
            data = response.json()
            assert len(data["response"]) > 0
        else:
            assert "detail" in response.json()
