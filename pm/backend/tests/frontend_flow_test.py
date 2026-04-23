#!/usr/bin/env python3
"""
Test to simulate exact frontend flow - debug why we get decode errors
"""
import sys
sys.path.insert(0, '/home/diegoscifo/Documents/workspace/personal/ia/AI Coder Vibe Coder to Agentic Engineer in 3 Weeks/pm/backend')

from fastapi.testclient import TestClient
from main import app
from app.models import Base
from sqlalchemy import create_engine, event, Engine
import sqlite3
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from db import get_db
import json

# Setup test database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
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

client = TestClient(app)

print("\n" + "=" * 70)
print("FRONTEND FLOW SIMULATION")
print("=" * 70)

# Step 1: Login (frontend does this)
print("\n[STEP 1] Frontend: POST /api/login")
response = client.post(
    "/api/login",
    json={"username": "user", "password": "password"}
)
print(f"Status: {response.status_code}")
login_data = response.json()
print(f"Response: {json.dumps(login_data, indent=2)}")

token = login_data['token']
print(f"\n[DEBUG] Token from login: {token}")
print(f"[DEBUG] Token type: {type(token)}")
print(f"[DEBUG] Token length: {len(token)}")

# Simulate frontend localStorage
print("\n[STEP 2] Frontend: Save to localStorage")
stored_data = {"token": token}
print(f"localStorage.setItem('kanban_auth', JSON.stringify({stored_data}))")

# Simulate reading from localStorage
print("\n[STEP 3] Frontend: Read from localStorage")
retrieved_token = stored_data["token"]
print(f"Retrieved token: {retrieved_token}")

# Simulate sending Authorization header
print("\n[STEP 4] Frontend: Build Authorization header")
auth_header = f"Bearer {retrieved_token}"
print(f"Authorization: {auth_header}")

# Step 5: Frontend fetches board
print("\n[STEP 5] Frontend: GET /api/user/board")
response = client.get(
    "/api/user/board",
    headers={"Authorization": auth_header}
)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    board = response.json()
    print(f"✓ Success! Board loaded: {board['id']}")
else:
    error = response.json()
    print(f"✗ Error: {error}")

print("\n" + "=" * 70 + "\n")
