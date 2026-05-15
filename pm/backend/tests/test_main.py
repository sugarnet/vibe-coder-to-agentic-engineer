def _register(client, username: str, password: str = "pass1234") -> str:
    response = client.post("/api/register", json={"username": username, "password": password})
    return response.json()["token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestLoginEndpoint:
    def test_login_with_valid_credentials(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        assert response.status_code == 200

    def test_login_returns_username_token_userid(self, client):
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        data = response.json()
        assert data["username"] == "user"
        assert len(data["token"]) > 0
        assert "user_id" in data

    def test_login_token_is_valid(self, client):
        r1 = client.post("/api/login", json={"username": "user", "password": "password"})
        r2 = client.post("/api/login", json={"username": "user", "password": "password"})
        token = r1.json()["token"]
        assert token == r2.json()["token"]

        response = client.get("/api/user/board", headers=_headers(token))
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

        board = client.get("/api/user/board", headers=_headers(token)).json()
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
        token = _register(client, "boarduser", "pass123")
        board = client.get("/api/user/board", headers=_headers(token)).json()
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
        assert len(board["columns"]) == 5
        assert isinstance(board["cards"], list)

    def test_list_boards(self, client, auth_headers):
        response = client.get("/api/boards", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_create_board(self, client, auth_headers):
        response = client.post("/api/boards", json={"title": "Sprint 1"}, headers=auth_headers)
        assert response.status_code == 201
        board = response.json()
        assert board["title"] == "Sprint 1"
        assert len(board["columns"]) == 5

    def test_get_specific_board(self, client, auth_headers):
        board_id = client.post("/api/boards", json={"title": "My Project"}, headers=auth_headers).json()["id"]
        response = client.get(f"/api/boards/{board_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["title"] == "My Project"

    def test_rename_board(self, client, auth_headers):
        board_id = client.post("/api/boards", json={"title": "Old Name"}, headers=auth_headers).json()["id"]
        response = client.put(
            f"/api/boards/{board_id}/title",
            json={"title": "New Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "New Name"

    def test_delete_board(self, client, auth_headers):
        client.post("/api/boards", json={"title": "To Delete"}, headers=auth_headers)
        client.post("/api/boards", json={"title": "Keeper"}, headers=auth_headers)

        boards = client.get("/api/boards", headers=auth_headers).json()
        target = next(b for b in boards if b["title"] == "To Delete")
        response = client.delete(f"/api/boards/{target['id']}", headers=auth_headers)
        assert response.status_code == 200

    def test_cannot_delete_last_board(self, client, auth_headers):
        boards = client.get("/api/boards", headers=auth_headers).json()
        for b in boards[1:]:
            client.delete(f"/api/boards/{b['id']}", headers=auth_headers)

        last = client.get("/api/boards", headers=auth_headers).json()[0]
        response = client.delete(f"/api/boards/{last['id']}", headers=auth_headers)
        assert response.status_code == 400

    def test_cannot_access_other_users_board(self, client):
        token_a = _register(client, "user_a", "pass123")
        token_b = _register(client, "user_b", "pass123")

        boards_a = client.get("/api/boards", headers=_headers(token_a)).json()
        response = client.get(f"/api/boards/{boards_a[0]['id']}", headers=_headers(token_b))
        assert response.status_code == 403


class TestColumnRoutes:
    def test_add_column(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        response = client.post(
            f"/api/boards/{board['id']}/columns",
            json={"title": "QA"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["title"] == "QA"

    def test_delete_column(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        col_id = client.post(
            f"/api/boards/{board['id']}/columns",
            json={"title": "Temp"},
            headers=auth_headers,
        ).json()["id"]

        response = client.delete(f"/api/boards/{board['id']}/columns/{col_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_cannot_delete_last_column(self, client, auth_headers):
        board_id = client.post("/api/boards", json={"title": "Minimal"}, headers=auth_headers).json()["id"]
        board = client.get(f"/api/boards/{board_id}", headers=auth_headers).json()

        for col in board["columns"][1:]:
            client.delete(f"/api/boards/{board_id}/columns/{col['id']}", headers=auth_headers)

        response = client.delete(
            f"/api/boards/{board_id}/columns/{board['columns'][0]['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestCardRoutes:
    def test_create_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        response = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "New Task", "details": "Task details"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        card = response.json()
        assert card["title"] == "New Task"
        assert card["details"] == "Task details"
        assert "id" in card

    def test_create_card_with_priority_and_due_date(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        response = client.post(
            "/api/cards",
            json={
                "column_id": board["columns"][0]["id"],
                "title": "Urgent Task",
                "priority": "high",
                "due_date": "2026-12-31",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        card = response.json()
        assert card["priority"] == "high"
        assert card["due_date"] == "2026-12-31"

    def test_create_card_invalid_priority(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        response = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "T", "priority": "urgent"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_card_requires_auth(self, client):
        response = client.post("/api/cards", json={"column_id": 1, "title": "Test", "details": ""})
        assert response.status_code == 403

    def test_update_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        card_id = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "Original"},
            headers=auth_headers,
        ).json()["id"]

        response = client.put(
            f"/api/cards/{card_id}",
            json={"title": "Updated", "priority": "low"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["title"] == "Updated"
        assert updated["priority"] == "low"

    def test_delete_card(self, client, auth_headers):
        board = client.get("/api/user/board", headers=auth_headers).json()
        card_id = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "To Delete"},
            headers=auth_headers,
        ).json()["id"]

        response = client.delete(f"/api/cards/{card_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"


class TestBoardBulkUpdate:
    def _make_card(self, client, headers):
        board = client.get("/api/user/board", headers=headers).json()
        col1_id = board["columns"][0]["id"]
        col2_id = board["columns"][1]["id"]
        card_id = client.post(
            "/api/cards",
            json={"column_id": col1_id, "title": "Card"},
            headers=headers,
        ).json()["id"]
        return board["id"], col1_id, col2_id, card_id

    def test_update_board_bulk(self, client, auth_headers):
        board_id, col1_id, col2_id, card_id = self._make_card(client, auth_headers)
        response = client.put(
            f"/api/boards/{board_id}",
            json={
                "columns": [
                    {"id": col1_id, "title": "To Do", "position": 0},
                    {"id": col2_id, "title": "In Progress", "position": 1},
                ],
                "cards": [{"id": card_id, "column_id": col2_id, "position": 0}],
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_legacy_board_update(self, client, auth_headers):
        _, col1_id, col2_id, card_id = self._make_card(client, auth_headers)
        response = client.put(
            "/api/board",
            json={
                "columns": [
                    {"id": col1_id, "title": "To Do", "position": 0},
                    {"id": col2_id, "title": "In Progress", "position": 1},
                ],
                "cards": [{"id": card_id, "column_id": col2_id, "position": 0}],
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestHealthCheck:
    def test_health_check_returns_200(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_returns_ok_status(self, client):
        assert client.get("/api/health").json()["status"] == "ok"

    def test_health_check_has_service_name(self, client):
        assert client.get("/api/health").json()["service"] == "kanban-api"


class TestEchoEndpoint:
    def test_echo_returns_200_for_valid_input(self, client):
        response = client.post("/api/echo", json={"test": "data"})
        assert response.status_code == 200

    def test_echo_reflects_input_correctly(self, client):
        payload = {"message": "hello", "count": 42}
        assert client.post("/api/echo", json=payload).json()["echo"] == payload

    def test_echo_returns_400_for_empty_body(self, client):
        response = client.post("/api/echo", json={})
        assert response.status_code == 400


class TestNotFoundRoutes:
    def test_undefined_route_returns_404(self, client):
        response = client.get("/api/undefined")
        assert response.status_code == 404


class TestUserIsolation:
    def _setup_two_users(self, client, suffix: str):
        token_a = _register(client, f"iso_{suffix}_a")
        token_b = _register(client, f"iso_{suffix}_b")
        return _headers(token_a), _headers(token_b)

    def test_user_cannot_update_another_users_card(self, client):
        headers_a, headers_b = self._setup_two_users(client, "upd")
        board = client.get("/api/user/board", headers=headers_a).json()
        card = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "A card"},
            headers=headers_a,
        ).json()

        response = client.put(f"/api/cards/{card['id']}", json={"title": "Stolen"}, headers=headers_b)
        assert response.status_code == 403

    def test_user_cannot_delete_another_users_card(self, client):
        headers_a, headers_b = self._setup_two_users(client, "del")
        board = client.get("/api/user/board", headers=headers_a).json()
        card = client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "A card"},
            headers=headers_a,
        ).json()

        response = client.delete(f"/api/cards/{card['id']}", headers=headers_b)
        assert response.status_code == 403

    def test_user_cannot_add_column_to_another_users_board(self, client):
        headers_a, headers_b = self._setup_two_users(client, "col")
        board = client.get("/api/user/board", headers=headers_a).json()

        response = client.post(
            f"/api/boards/{board['id']}/columns",
            json={"title": "Stolen"},
            headers=headers_b,
        )
        assert response.status_code == 403

    def test_board_data_is_scoped_to_user(self, client):
        headers_a, headers_b = self._setup_two_users(client, "scope")

        board_a = client.get("/api/user/board", headers=headers_a).json()
        client.post(
            "/api/cards",
            json={"column_id": board_a["columns"][0]["id"], "title": "Secret card"},
            headers=headers_a,
        )

        board_b = client.get("/api/user/board", headers=headers_b).json()
        assert "Secret card" not in [c["title"] for c in board_b["cards"]]


class TestCardFieldEdgeCases:
    def _make_card(self, client, headers, **extra):
        board = client.get("/api/user/board", headers=headers).json()
        return client.post(
            "/api/cards",
            json={"column_id": board["columns"][0]["id"], "title": "T", **extra},
            headers=headers,
        ).json()

    def test_update_card_clears_priority(self, client, auth_headers):
        card = self._make_card(client, auth_headers, priority="high")
        assert card["priority"] == "high"

        updated = client.put(f"/api/cards/{card['id']}", json={"priority": None}, headers=auth_headers).json()
        assert updated["priority"] is None

    def test_update_card_clears_due_date(self, client, auth_headers):
        card = self._make_card(client, auth_headers, due_date="2026-12-31")
        assert card["due_date"] == "2026-12-31"

        updated = client.put(f"/api/cards/{card['id']}", json={"due_date": None}, headers=auth_headers).json()
        assert updated["due_date"] is None

    def test_card_color_field(self, client, auth_headers):
        card = self._make_card(client, auth_headers, color="#ff0000")
        assert card["color"] == "#ff0000"

        updated = client.put(f"/api/cards/{card['id']}", json={"color": None}, headers=auth_headers).json()
        assert updated["color"] is None

    def test_column_positions_reorder_after_delete(self, client, auth_headers):
        board_id = client.post("/api/boards", json={"title": "Pos Test"}, headers=auth_headers).json()["id"]
        client.post(f"/api/boards/{board_id}/columns", json={"title": "Extra"}, headers=auth_headers)
        board = client.get(f"/api/boards/{board_id}", headers=auth_headers).json()
        assert len(board["columns"]) == 6

        client.delete(f"/api/boards/{board_id}/columns/{board['columns'][1]['id']}", headers=auth_headers)

        board = client.get(f"/api/boards/{board_id}", headers=auth_headers).json()
        assert len(board["columns"]) == 5
        positions = [col["position"] for col in board["columns"]]
        assert positions == list(range(len(positions)))
