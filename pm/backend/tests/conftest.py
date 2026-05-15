import sqlite3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud
from app.models import Base
from main import app, get_db


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_conn, connection_record):
    if isinstance(dbapi_conn, sqlite3.Connection):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _build_test_db(seed_user: bool = True):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    if seed_user:
        db = SessionLocal()
        try:
            crud.get_or_create_user(db, "user", "password")
        finally:
            db.close()

    return SessionLocal


@pytest.fixture
def test_db():
    SessionLocal = _build_test_db(seed_user=True)
    yield SessionLocal
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_db):
    return TestClient(app)


@pytest.fixture
def auth_token(client):
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    return response.json()["token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
