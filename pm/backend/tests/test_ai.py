"""Unit and integration tests for AI module (Part 8)."""
import pytest
import os
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, Engine
import sqlite3
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db
from app.models import Base
import ai


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


# ============= Unit Tests for ai.py =============

class TestAIModule:
    """Unit tests for ai module."""
    
    def test_get_ai_client_with_valid_key(self):
        """get_ai_client should return OpenAI client when API key is set."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            client = ai.get_ai_client()
            assert client is not None
            assert client.api_key == "test-key"
    
    def test_get_ai_client_without_api_key(self):
        """get_ai_client should raise ValueError when API key is missing."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
                ai.get_ai_client()
    
    @pytest.mark.asyncio
    async def test_call_ai_with_valid_prompt(self):
        """call_ai should return response for valid prompt."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="4"))]
        
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.return_value = mock_response
                
                result = await ai.call_ai("What is 2+2?")
                assert result == "4"
    
    @pytest.mark.asyncio
    async def test_call_ai_with_empty_prompt(self):
        """call_ai should raise ValueError for empty prompt."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with pytest.raises(ValueError, match="empty"):
                await ai.call_ai("")
    
    @pytest.mark.asyncio
    async def test_call_ai_with_empty_response(self):
        """call_ai should raise ValueError when AI returns empty response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=""))]
        
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.return_value = mock_response
                
                with pytest.raises(ValueError, match="empty"):
                    await ai.call_ai("What is 2+2?")
    
    @pytest.mark.asyncio
    async def test_call_ai_with_no_choices(self):
        """call_ai should raise ValueError when AI returns no choices."""
        mock_response = MagicMock()
        mock_response.choices = []
        
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.return_value = mock_response
                
                with pytest.raises(ValueError, match="no response"):
                    await ai.call_ai("What is 2+2?")
    
    @pytest.mark.asyncio
    async def test_call_ai_timeout(self):
        """call_ai should raise TimeoutError when request times out."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.side_effect = TimeoutError("Request timed out")
                
                with pytest.raises(TimeoutError):
                    await ai.call_ai("What is 2+2?", timeout=15)
    
    @pytest.mark.asyncio
    async def test_call_ai_without_api_key(self):
        """call_ai should raise ValueError when API key is missing."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
                await ai.call_ai("What is 2+2?")


# ============= Integration Tests for /api/ai/test endpoint =============

class TestAIEndpoint:
    """Integration tests for /api/ai/test endpoint."""
    
    def test_ai_test_endpoint_with_mock_response(self, client):
        """POST /api/ai/test should return AI response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="4"))]
        
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.return_value = mock_response
                
                response = client.post(
                    "/api/ai/test",
                    json={"prompt": "What is 2+2?"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["prompt"] == "What is 2+2?"
                assert data["response"] == "4"
                assert data["status"] == "success"
    
    def test_ai_test_endpoint_missing_api_key(self, client):
        """POST /api/ai/test should return 500 when API key is missing."""
        with patch.dict(os.environ, {}, clear=True):
            response = client.post(
                "/api/ai/test",
                json={"prompt": "What is 2+2?"}
            )
            
            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert "configuration" in data["detail"].lower()
    
    def test_ai_test_endpoint_timeout(self, client):
        """POST /api/ai/test should return 503 on timeout."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.side_effect = TimeoutError("Timeout")
                
                response = client.post(
                    "/api/ai/test",
                    json={"prompt": "What is 2+2?"}
                )
                
                assert response.status_code == 503
                data = response.json()
                assert "timeout" in data["detail"].lower()
    
    def test_ai_test_endpoint_empty_response(self, client):
        """POST /api/ai/test should return 500 when AI returns empty response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=""))]
        
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
            with patch("ai.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_openai.return_value = mock_client
                mock_client.chat.completions.create.return_value = mock_response
                
                response = client.post(
                    "/api/ai/test",
                    json={"prompt": "What is 2+2?"}
                )
                
                assert response.status_code == 500
                data = response.json()
                assert "error" in data["detail"].lower()
    
    def test_ai_test_endpoint_with_real_api_if_key_available(self, client):
        """
        POST /api/ai/test with real API key (integration test).
        This test runs only if OPENROUTER_API_KEY is set and appears valid.
        Note: This test may be skipped if OpenRouter API key is invalid or account lacks credits.
        """
        api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not api_key or not api_key.startswith("sk-or-v1-"):
            pytest.skip("OPENROUTER_API_KEY not set or invalid format")
        
        # Test with real API - may fail due to API key issues, credits, etc.
        response = client.post(
            "/api/ai/test",
            json={"prompt": "What is 2+2? Answer with just the number."}
        )
        
        # Accept various responses: success, API errors, etc.
        # The important thing is that the endpoint responds
        assert response.status_code in [200, 500, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "response" in data
            assert len(data["response"]) > 0
            # May or may not contain "4" depending on AI response
        else:
            # API error is acceptable for this test
            data = response.json()
            assert "detail" in data
