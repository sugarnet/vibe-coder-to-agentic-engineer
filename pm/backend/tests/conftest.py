"""Shared pytest fixtures for all backend tests."""
import pytest
import sqlite3
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db
from app.models import Base
import app.crud as crud


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory database and seed default user."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

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

    # Seed default user in test DB
    db = SessionLocal()
    try:
        crud.get_or_create_user(db, "user", "password")
    finally:
        db.close()

    yield SessionLocal

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(test_db):
    return TestClient(app)


@pytest.fixture(scope="function")
def auth_token(client):
    """Log in as default user and return token."""
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    return response.json()["token"]


@pytest.fixture(scope="function")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
