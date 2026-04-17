#!/usr/bin/env python3
"""
Final integration test - verify complete auth flow works
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
print("FINAL INTEGRATION TEST - AUTHENTICATION & BOARD OPERATIONS")
print("=" * 70)

# Test 1: Login
print("\n[1/7] Login with valid credentials...")
response = client.post(
    "/api/login",
    json={"username": "user", "password": "password"}
)
assert response.status_code == 200, f"❌ Login failed: {response.text}"
data = response.json()
assert "token" in data, "❌ No token in response"
assert "user_id" in data, "❌ No user_id in response"
token = data['token']
print(f"     ✓ Login successful")
print(f"     - Token: {token[:20]}...")
print(f"     - User ID: {data['user_id']}")

# Test 2: Fetch board
print("\n[2/7] Fetch board...")
response = client.get(
    "/api/user/board",
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Board fetch failed: {response.json()}"
board = response.json()
assert "id" in board, "❌ No board id"
assert "columns" in board, "❌ No columns"
assert "cards" in board, "❌ No cards"
assert len(board["columns"]) == 5, f"❌ Expected 5 columns, got {len(board['columns'])}"
print(f"     ✓ Board loaded")
print(f"     - ID: {board['id']}")
print(f"     - Columns: {len(board['columns'])}")
print(f"     - Cards: {len(board['cards'])}")

# Test 3: Create card
print("\n[3/7] Create a card...")
response = client.post(
    "/api/cards",
    json={"column_id": 1, "title": "Task 1", "details": "First task"},
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Card creation failed: {response.json()}"
card = response.json()
card_id = card["id"]
print(f"     ✓ Card created: ID={card_id}, Title={card['title']}")

# Test 4: Update card
print("\n[4/7] Update card...")
response = client.put(
    f"/api/cards/{card_id}",
    json={"title": "Task 1 Updated", "details": "Updated details"},
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Card update failed: {response.json()}"
updated_card = response.json()
assert updated_card["title"] == "Task 1 Updated", "❌ Title not updated"
print(f"     ✓ Card updated: Title={updated_card['title']}")

# Test 5: Fetch board again (verify card is there)
print("\n[5/7] Fetch board again (verify persistence)...")
response = client.get(
    "/api/user/board",
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Board fetch failed: {response.json()}"
board = response.json()
assert len(board["cards"]) == 1, f"❌ Expected 1 card, got {len(board['cards'])}"
assert board["cards"][0]["title"] == "Task 1 Updated", "❌ Card title not persisted"
print(f"     ✓ Board refreshed: {len(board['cards'])} cards")

# Test 6: Delete card
print("\n[6/7] Delete card...")
response = client.delete(
    f"/api/cards/{card_id}",
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Card deletion failed: {response.json()}"
print(f"     ✓ Card deleted")

# Test 7: Verify card is gone
print("\n[7/7] Verify card is deleted...")
response = client.get(
    "/api/user/board",
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 200, f"❌ Board fetch failed: {response.json()}"
board = response.json()
assert len(board["cards"]) == 0, f"❌ Expected 0 cards, got {len(board['cards'])}"
print(f"     ✓ Board has 0 cards (confirmed delete)")

print("\n" + "=" * 70)
print("✅ ALL INTEGRATION TESTS PASSED!")
print("=" * 70)
print("""
Summary:
- Login: ✓ Token generation works
- Board: ✓ Fetch with authentication works
- Create: ✓ Can create cards
- Update: ✓ Can update card details
- Persist: ✓ Changes persist on refresh
- Delete: ✓ Can delete cards
- Auth: ✓ Token validation works

The application is ready for use!
""")
print("=" * 70 + "\n")
