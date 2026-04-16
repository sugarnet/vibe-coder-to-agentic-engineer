"""Unit tests for FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestLoginEndpoint:
    """Tests for login endpoint."""

    def test_login_with_valid_credentials(self):
        """Login with correct credentials should return 200."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        assert response.status_code == 200

    def test_login_returns_username_and_token(self):
        """Login response should contain username and token."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"}
        )
        data = response.json()
        assert "username" in data
        assert "token" in data
        assert data["username"] == "user"
        assert len(data["token"]) > 0

    def test_login_token_is_unique(self):
        """Each login should generate a unique token."""
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
        assert token1 != token2

    def test_login_with_wrong_password(self):
        """Login with wrong password should return 401."""
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "wrong"}
        )
        assert response.status_code == 401

    def test_login_with_wrong_username(self):
        """Login with wrong username should return 401."""
        response = client.post(
            "/api/login",
            json={"username": "wrong", "password": "password"}
        )
        assert response.status_code == 401

    def test_login_with_empty_credentials(self):
        """Login with empty credentials should return 401."""
        response = client.post(
            "/api/login",
            json={"username": "", "password": ""}
        )
        assert response.status_code == 401


class TestHealthCheck:
    """Tests for health check endpoint."""

    def test_health_check_returns_200(self):
        """Health endpoint should return 200 status."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_returns_ok_status(self):
        """Health endpoint should return status: ok."""
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_check_has_service_name(self):
        """Health endpoint should identify service."""
        response = client.get("/api/health")
        data = response.json()
        assert "service" in data
        assert data["service"] == "kanban-api"


class TestEchoEndpoint:
    """Tests for echo endpoint."""

    def test_echo_returns_200_for_valid_input(self):
        """Echo endpoint should return 200 for valid JSON."""
        response = client.post("/api/echo", json={"test": "data"})
        assert response.status_code == 200

    def test_echo_reflects_input_correctly(self):
        """Echo endpoint should return input in response."""
        test_data = {"message": "hello", "count": 42}
        response = client.post("/api/echo", json=test_data)
        data = response.json()
        assert data["echo"] == test_data

    def test_echo_with_nested_objects(self):
        """Echo endpoint should handle nested objects."""
        test_data = {"nested": {"key": "value"}, "list": [1, 2, 3]}
        response = client.post("/api/echo", json=test_data)
        data = response.json()
        assert data["echo"] == test_data

    def test_echo_returns_400_for_empty_body(self):
        """Echo endpoint should reject empty body."""
        response = client.post("/api/echo", json={})
        assert response.status_code == 400


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_returns_200(self):
        """Root endpoint should return 200 status."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_data(self):
        """Root endpoint should return data (fallback or static)."""
        response = client.get("/")
        # Part 3: Could be JSON (fallback) or HTML (static frontend)
        # Just verify we get content
        assert len(response.text) > 0

    def test_root_has_kanban_or_message(self):
        """Root endpoint should mention Kanban or be a valid response."""
        response = client.get("/")
        text_lower = response.text.lower()
        # Could be Kanban Studio (from Next.js) or API message (from fallback)
        assert "kanban" in text_lower or "api" in text_lower


class TestTestMath:
    """Tests for test math endpoint."""

    def test_math_endpoint_returns_200(self):
        """Math test endpoint should return 200."""
        response = client.get("/api/test-math")
        assert response.status_code == 200

    def test_math_endpoint_correct_answer(self):
        """Math test endpoint should return correct answer."""
        response = client.get("/api/test-math")
        data = response.json()
        assert data["answer"] == 4


class TestNotFoundRoutes:
    """Tests for 404 handling."""

    def test_undefined_route_returns_404(self):
        """Undefined routes should return 404."""
        response = client.get("/api/undefined")
        assert response.status_code == 404

    def test_undefined_post_returns_404(self):
        """Undefined POST routes should return 404."""
        response = client.post("/api/does-not-exist", json={})
        assert response.status_code == 404
