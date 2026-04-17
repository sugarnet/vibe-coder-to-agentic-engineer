#!/usr/bin/env python3
"""Quick test to check if the backend API returns correct structure."""
import subprocess
import time
import requests
import sys

# Start the server
print("Starting backend server...")
server = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd="/home/diegoscifo/Documents/workspace/personal/ia/AI Coder Vibe Coder to Agentic Engineer in 3 Weeks/pm",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Wait for server to start
time.sleep(3)

try:
    # Test login
    print("\n1. Testing POST /api/login...")
    response = requests.post("http://localhost:8000/api/login", json={"username": "user", "password": "password"})
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        login_data = response.json()
        print(f"Response: {login_data}")
        token = login_data.get("access_token")
        
        # Test board fetch
        print("\n2. Testing GET /api/user/board...")
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get("http://localhost:8000/api/user/board", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            board = response.json()
            print(f"Board structure:")
            print(f"  - id: {board.get('id')}")
            print(f"  - title: {board.get('title')}")
            print(f"  - columns: {len(board.get('columns', []))} columns")
            print(f"  - cards: {len(board.get('cards', []))} cards (MUST exist)")
            
            if 'cards' in board:
                print("\n✅ SUCCESS: cards field exists in response!")
            else:
                print("\n❌ ERROR: cards field is missing from response!")
        else:
            print(f"Error: {response.text}")
    else:
        print(f"Error: {response.text}")
        
finally:
    print("\nStopping server...")
    server.terminate()
    server.wait(timeout=5)
