"""Unit tests for FastAPI endpoints and database persistence (Part 6)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, Engine
import sqlite3
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, valid_tokens, get_db
from app.models import Base


# Create test database (in-memory SQLite)
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
    valid_tokens.clear()  # Clear tokens before each test
    return TestClient(app)


class TestLoginEndpoint:
    """Tests for login endpoint with database."""

    def test_login_with_valid_credentials(self, client):
        """Login with correct credentials should return 200."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        assert response.status_code == 200

    def test_login_returns_username_token_userid(self, client):
        """Login response should contain username, token and user_id."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        data = response.json()
        assert "username" in data
        assert "token" in data
        assert "user_id" in data
        assert data["username"] == "user"
        assert len(data["token"]) > 0

    def test_login_token_is_valid(self, client):
        """Login should generate a valid token that can be used."""
        response1 = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        response2 = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token1 = response1.json()["token"]
        token2 = response2.json()["token"]
        # With stateless tokens, the same user gets the same token
        assert token1 == token2
        # Verify token can be used
        assert len(token1) > 0
        # Use token to access protected endpoint
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert response.status_code == 200

    def test_login_with_wrong_password(self, client):
        """Login with wrong password should return 401."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "wrong"}
        )
        assert response.status_code == 401

    def test_login_with_wrong_username(self, client):
        """Login with wrong username should return 401."""
        response = client.post(
            "/api/login",
            json={"username": "wrong", "password": "password"}
        )
        assert response.status_code == 401

    def test_login_creates_board(self, client):
        """Login creates default board with 5 columns."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        # Fetch board
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        board = response.json()
        assert len(board["columns"]) == 5
        assert board["columns"][0]["title"] == "To Do"


class TestBoardRoutes:
    """Board API tests."""
    
    def test_get_user_board_requires_auth(self, client):
        """Access without token returns 403."""
        response = client.get("/api/user/board")
        assert response.status_code == 403
    
    def test_get_user_board_success(self, client):
        """Fetch user's board with columns and cards."""
        # Login
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        # Fetch board
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        board = response.json()
        assert "id" in board
        assert "columns" in board
        assert "cards" in board, "Response must include 'cards' array"
        assert len(board["columns"]) == 5
        assert isinstance(board["cards"], list), "'cards' must be an array"
        # Cards can be empty for a new board
        assert isinstance(board["cards"], list), "'cards' must be  a list (can be empty)"


class TestCardRoutes:
    """Card CRUD tests."""
    
    def test_create_card(self, client):
        """Create a card in a column."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        # Get board to find column
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        board = response.json()
        column_id = board["columns"][0]["id"]
        
        # Create card
        response = client.post(
            "/api/cards",
            json={
                "column_id": column_id,
                "title": "New Task",
                "details": "Task details"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        card = response.json()
        assert card["title"] == "New Task"
        assert card["details"] == "Task details"
        assert "id" in card
    
    def test_create_card_requires_auth(self, client):
        """Create card without auth returns 403."""
        response = client.post(
            "/api/cards",
            json={"column_id": 1, "title": "Test", "details": ""}
        )
        assert response.status_code == 403
    
    def test_update_card(self, client):
        """Update card title and details."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        # Get board
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        board = response.json()
        column_id = board["columns"][0]["id"]
        
        # Create card
        response = client.post(
            "/api/cards",
            json={"column_id": column_id, "title": "Original", "details": "Original"},
            headers={"Authorization": f"Bearer {token}"}
        )
        card_id = response.json()["id"]
        
        # Update card
        response = client.put(
            f"/api/cards/{card_id}",
            json={"title": "Updated", "details": "Updated details"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["title"] == "Updated"
        assert updated["details"] == "Updated details"
    
    def test_delete_card(self, client):
        """Delete a card."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        board = response.json()
        column_id = board["columns"][0]["id"]
        
        # Create and delete card
        response = client.post(
            "/api/cards",
            json={"column_id": column_id, "title": "To Delete", "details": ""},
            headers={"Authorization": f"Bearer {token}"}
        )
        card_id = response.json()["id"]
        
        response = client.delete(
            f"/api/cards/{card_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"


class TestBoardBulkUpdate:
    """Bulk board update tests (drag-drop)."""
    
    def test_update_board_bulk(self, client):
        """Bulk update columns and cards."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        token = response.json()["token"]
        
        response = client.get(
            "/api/user/board",
            headers={"Authorization": f"Bearer {token}"}
        )
        board = response.json()
        col1_id = board["columns"][0]["id"]
        col2_id = board["columns"][1]["id"]
        
        # Create a card
        response = client.post(
            "/api/cards",
            json={"column_id": col1_id, "title": "Card", "details": ""},
            headers={"Authorization": f"Bearer {token}"}
        )
        card_id = response.json()["id"]
        
        # Move card to different column
        response = client.put(
            "/api/board",
            json={
                "columns": [
                    {"id": col1_id, "title": "To Do", "position": 0},
                    {"id": col2_id, "title": "In Progress", "position": 1},
                ],
                "cards": [
                    {"id": card_id, "column_id": col2_id, "position": 0}
                ]
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestHealthCheck:
    """Tests for health check endpoint."""

    def test_health_check_returns_200(self, client):
        """Health endpoint should return 200 status."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_returns_ok_status(self, client):
        """Health endpoint should return status: ok."""
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_check_has_service_name(self, client):
        """Health endpoint should identify service."""
        response = client.get("/api/health")
        data = response.json()
        assert "service" in data
        assert data["service"] == "kanban-api"


class TestEchoEndpoint:
    """Tests for echo endpoint."""

    def test_echo_returns_200_for_valid_input(self, client):
        """Echo endpoint should return 200 for valid JSON."""
        response = client.post("/api/echo", json={"test": "data"})
        assert response.status_code == 200

    def test_echo_reflects_input_correctly(self, client):
        """Echo endpoint should return input in response."""
        test_data = {"message": "hello", "count": 42}
        response = client.post("/api/echo", json=test_data)
        data = response.json()
        assert data["echo"] == test_data

    def test_echo_with_nested_objects(self, client):
        """Echo endpoint should handle nested objects."""
        test_data = {"nested": {"key": "value"}, "list": [1, 2, 3]}
        response = client.post("/api/echo", json=test_data)
        data = response.json()
        assert data["echo"] == test_data

    def test_echo_returns_400_for_empty_body(self, client):
        """Echo endpoint should reject empty body."""
        response = client.post("/api/echo", json={})
        assert response.status_code == 400


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_returns_200(self, client):
        """Root endpoint should return 200 status."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_data(self, client):
        """Root endpoint should return data (fallback or static)."""
        response = client.get("/")
        assert len(response.text) > 0

    def test_root_has_kanban_or_message(self, client):
        """Root endpoint should mention Kanban or be a valid response."""
        response = client.get("/")
        text_lower = response.text.lower()
        assert "kanban" in text_lower or "api" in text_lower


class TestTestMath:
    """Tests for test math endpoint."""

    def test_math_endpoint_returns_200(self, client):
        """Math test endpoint should return 200."""
        response = client.get("/api/test-math")
        assert response.status_code == 200

    def test_math_endpoint_correct_answer(self, client):
        """Math test endpoint should return correct answer."""
        response = client.get("/api/test-math")
        data = response.json()
        assert data["answer"] == 4


class TestNotFoundRoutes:
    """Tests for 404 handling."""

    def test_undefined_route_returns_404(self, client):
        """Undefined routes should return 404."""
        response = client.get("/api/undefined")
        assert response.status_code == 404

    def test_undefined_post_returns_404(self, client):
        """Undefined POST routes should return 404."""
        response = client.post("/api/does-not-exist", json={})
        assert response.status_code == 404

