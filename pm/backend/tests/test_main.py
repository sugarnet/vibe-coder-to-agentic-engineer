"""Tests for FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient

from main import app


class TestLoginEndpoint:
    def test_login_with_valid_credentials(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        assert response.status_code == 200

    def test_login_returns_username_token_userid(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        data = response.json()
        assert "username" in data
        assert "token" in data
        assert "user_id" in data
        assert data["username"] == "user"
        assert len(data["token"]) > 0

    def test_login_token_is_valid(self, client):
        response1 = client.post("/api/login", json={"username": "user", "password": "password"})
        response2 = client.post("/api/login", json={"username": "user", "password": "password"})
        token1 = response1.json()["token"]
        token2 = response2.json()["token"]
        assert token1 == token2
        assert len(token1) > 0

        response = client.get("/api/user/board", headers={"Authorization": f"Bearer {token1}"})
        assert response.status_code == 200

    def test_login_with_wrong_password(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "wrong"})
        assert response.status_code == 401

    def test_login_with_wrong_username(self, client):
        response = client.post("/api/login", json={"username": "nobody", "password": "password"})
        assert response.status_code == 401

    def test_login_creates_board(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        token = response.json()["token"]

        response = client.get("/api/user/board", headers={"Authorization": f"Bearer {token}"})
        board = response.json()
        assert len(board["columns"]) == 5
        assert board["columns"][0]["title"] == "To Do"


class TestRegisterEndpoint:
    def test_register_new_user(self, client):
        response = client.post("/api/register", json={"username": "newuser", "password": "secure123"})
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert "token" in data
        assert "user_id" in data

    def test_register_duplicate_username(self, client):
        client.post("/api/register", json={"username": "dupuser", "password": "pass123"})
        response = client.post("/api/register", json={"username": "dupuser", "password": "pass123"})
        assert response.status_code == 409

    def test_register_short_password_fails(self, client):
        response = client.post("/api/register", json={"username": "validuser", "password": "abc"})
        assert response.status_code == 422

    def test_register_short_username_fails(self, client):
        response = client.post("/api/register", json={"username": "ab", "password": "secure123"})
        assert response.status_code == 422

    def test_register_creates_default_board(self, client):
        response = client.post("/api/register", json={"username": "boarduser", "password": "pass123"})
        token = response.json()["token"]

        response = client.get("/api/user/board", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        board = response.json()
        assert len(board["columns"]) == 5

    def test_registered_user_can_login(self, client):
        client.post("/api/register", json={"username": "logintest", "password": "mypass123"})
        response = client.post("/api/login", json={"username": "logintest", "password": "mypass123"})
        assert response.status_code == 200

    def test_registered_user_wrong_password(self, client):
        client.post("/api/register", json={"username": "pwtest", "password": "correct123"})
        response = client.post("/api/login", json={"username": "pwtest", "password": "wrong123"})
        assert response.status_code == 401


class TestBoardRoutes:
    def test_get_user_board_requires_auth(self, client):
        response = client.get("/api/user/board")
        assert response.status_code == 403

    def test_get_user_board_success(self, client, auth_headers):
        response = client.get("/api/user/board", headers=auth_headers)
        assert response.status_code == 200
        board = response.json()
        assert "id" in board
        assert "columns" in board
        assert "cards" in board
        assert len(board["columns"]) == 5
        assert isinstance(board["cards"], list)

    def test_list_boards(self, client, auth_headers):
        response = client.get("/api/boards", headers=auth_headers)
        assert response.status_code == 200
        boards = response.json()
        assert isinstance(boards, list)
        assert len(boards) >= 1

    def test_create_board(self, client, auth_headers):
        response = client.post("/api/boards", json={"title": "Sprint 1"}, headers=auth_headers)
        assert response.status_code == 201
        board = response.json()
        assert board["title"] == "Sprint 1"
        assert len(board["columns"]) == 5

    def test_get_specific_board(self, client, auth_headers):
        create_resp = client.post("/api/boards", json={"title": "My Project"}, headers=auth_headers)
        board_id = create_resp.json()["id"]

        response = client.get(f"/api/boards/{board_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["title"] == "My Project"

    def test_rename_board(self, client, auth_headers):
        create_resp = client.post("/api/boards", json={"title": "Old Name"}, headers=auth_headers)
        board_id = create_resp.json()["id"]

        response = client.put(f"/api/boards/{board_id}/title", json={"title": "New Name"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["title"] == "New Name"

    def test_delete_board(self, client, auth_headers):
        client.post("/api/boards", json={"title": "To Delete"}, headers=auth_headers)
        client.post("/api/boards", json={"title": "Keeper"}, headers=auth_headers)

        boards = client.get("/api/boards", headers=auth_headers).json()
        board_to_delete = next(b for b in boards if b["title"] == "To Delete")

        response = client.delete(f"/api/boards/{board_to_delete['id']}", headers=auth_headers)
        assert response.status_code == 200

    def test_cannot_delete_last_board(self, client, auth_headers):
        boards = client.get("/api/boards", headers=auth_headers).json()
        # Delete all but one
        for b in boards[1:]:
            client.delete(f"/api/boards/{b['id']}", headers=auth_headers)

        last_board = client.get("/api/boards", headers=auth_headers).json()[0]
        response = client.delete(f"/api/boards/{last_board['id']}", headers=auth_headers)
        assert response.status_code == 400

    def test_cannot_access_other_users_board(self, client):
        client.post("/api/register", json={"username": "user_a", "password": "pass123"})
        resp_b = client.post("/api/register", json={"username": "user_b", "password": "pass123"})
        token_b = resp_b.json()["token"]

        boards_a = client.get("/api/boards", headers={"Authorization": f"Bearer {client.post('/api/login', json={'username': 'user_a', 'password': 'pass123'}).json()['token']}"}).json()
        board_a_id = boards_a[0]["id"]

        response = client.get(f"/api/boards/{board_a_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert response.status_code == 403


class TestColumnRoutes:
    def test_add_column(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        board_id = board["id"]

        response = client.post(f"/api/boards/{board_id}/columns", json={"title": "QA"}, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["title"] == "QA"

    def test_delete_column(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        board_id = board["id"]

        # Add a column so we have 6 total, then delete it
        add_resp = client.post(f"/api/boards/{board_id}/columns", json={"title": "Temp"}, headers=auth_headers)
        col_id = add_resp.json()["id"]

        response = client.delete(f"/api/boards/{board_id}/columns/{col_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_cannot_delete_last_column(self, client, auth_headers):
        # Create a board then delete all but one column
        board_resp = client.post("/api/boards", json={"title": "Minimal"}, headers=auth_headers)
        board_id = board_resp.json()["id"]
        board = client.get(f"/api/boards/{board_id}", headers=auth_headers).json()

        # Delete all but the first column
        for col in board["columns"][1:]:
            client.delete(f"/api/boards/{board_id}/columns/{col['id']}", headers=auth_headers)

        first_col_id = board["columns"][0]["id"]
        response = client.delete(f"/api/boards/{board_id}/columns/{first_col_id}", headers=auth_headers)
        assert response.status_code == 400


class TestCardRoutes:
    def test_create_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        column_id = board["columns"][0]["id"]

        response = client.post("/api/cards", json={"column_id": column_id, "title": "New Task", "details": "Task details"}, headers=auth_headers)
        assert response.status_code == 200
        card = response.json()
        assert card["title"] == "New Task"
        assert card["details"] == "Task details"
        assert "id" in card

    def test_create_card_with_priority_and_due_date(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        column_id = board["columns"][0]["id"]

        response = client.post("/api/cards", json={
            "column_id": column_id,
            "title": "Urgent Task",
            "priority": "high",
            "due_date": "2026-12-31",
        }, headers=auth_headers)
        assert response.status_code == 200
        card = response.json()
        assert card["priority"] == "high"
        assert card["due_date"] == "2026-12-31"

    def test_create_card_invalid_priority(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        column_id = board["columns"][0]["id"]
        response = client.post("/api/cards", json={"column_id": column_id, "title": "T", "priority": "urgent"}, headers=auth_headers)
        assert response.status_code == 422

    def test_create_card_requires_auth(self, client):
        response = client.post("/api/cards", json={"column_id": 1, "title": "Test", "details": ""})
        assert response.status_code == 403

    def test_update_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        column_id = board["columns"][0]["id"]

        create_resp = client.post("/api/cards", json={"column_id": column_id, "title": "Original"}, headers=auth_headers)
        card_id = create_resp.json()["id"]

        response = client.put(f"/api/cards/{card_id}", json={"title": "Updated", "priority": "low"}, headers=auth_headers)
        assert response.status_code == 200
        updated = response.json()
        assert updated["title"] == "Updated"
        assert updated["priority"] == "low"

    def test_delete_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        column_id = board["columns"][0]["id"]

        create_resp = client.post("/api/cards", json={"column_id": column_id, "title": "To Delete"}, headers=auth_headers)
        card_id = create_resp.json()["id"]

        response = client.delete(f"/api/cards/{card_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"


class TestBoardBulkUpdate:
    def test_update_board_bulk(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        col1_id = board["columns"][0]["id"]
        col2_id = board["columns"][1]["id"]

        create_resp = client.post("/api/cards", json={"column_id": col1_id, "title": "Card"}, headers=auth_headers)
        card_id = create_resp.json()["id"]

        board_id = board["id"]
        response = client.put(f"/api/boards/{board_id}", json={
            "columns": [
                {"id": col1_id, "title": "To Do", "position": 0},
                {"id": col2_id, "title": "In Progress", "position": 1},
            ],
            "cards": [{"id": card_id, "column_id": col2_id, "position": 0}],
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_legacy_board_update(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        col1_id = board["columns"][0]["id"]
        col2_id = board["columns"][1]["id"]

        create_resp = client.post("/api/cards", json={"column_id": col1_id, "title": "Card2"}, headers=auth_headers)
        card_id = create_resp.json()["id"]

        response = client.put("/api/board", json={
            "columns": [
                {"id": col1_id, "title": "To Do", "position": 0},
                {"id": col2_id, "title": "In Progress", "position": 1},
            ],
            "cards": [{"id": card_id, "column_id": col2_id, "position": 0}],
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestHealthCheck:
    def test_health_check_returns_200(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_returns_ok_status(self, client):
        data = client.get("/api/health").json()
        assert data["status"] == "ok"

    def test_health_check_has_service_name(self, client):
        data = client.get("/api/health").json()
        assert data["service"] == "kanban-api"


class TestEchoEndpoint:
    def test_echo_returns_200_for_valid_input(self, client):
        response = client.post("/api/echo", json={"test": "data"})
        assert response.status_code == 200

    def test_echo_reflects_input_correctly(self, client):
        test_data = {"message": "hello", "count": 42}
        data = client.post("/api/echo", json=test_data).json()
        assert data["echo"] == test_data

    def test_echo_returns_400_for_empty_body(self, client):
        response = client.post("/api/echo", json={})
        assert response.status_code == 400


class TestNotFoundRoutes:
    def test_undefined_route_returns_404(self, client):
        response = client.get("/api/undefined")
        assert response.status_code == 404
