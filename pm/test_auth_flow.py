#!/usr/bin/env python3
"""Test the authentication flow end-to-end."""
import subprocess
import time
import json
import sys

print("=" * 60)
print("Testing Authentication Flow")
print("=" * 60)
print("")

# Start backend
print("1. Starting backend server...")
server_proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd="/home/diegoscifo/Documents/workspace/personal/ia/AI Coder Vibe Coder to Agentic Engineer in 3 Weeks/pm",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

time.sleep(2)

try:
    print("   ✓ Backend started\n")
    
    # Test 1: Login
    print("2. Testing POST /api/login...")
    import subprocess as sp
    
    result = sp.run(
        ['curl', '-s', '-X', 'POST', 'http://localhost:8000/api/login',
         '-H', 'Content-Type: application/json',
         '-d', '{"username": "user", "password": "password"}'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"   ✗ Error: {result.stderr}")
        sys.exit(1)
    
    login_data = json.loads(result.stdout)
    print(f"   Response: {json.dumps(login_data, indent=2)}")
    
    if 'token' not in login_data:
        print("   ✗ ERROR: 'token' field not in response!")
        sys.exit(1)
    
    token = login_data['token']
    print(f"   ✓ Token obtained: {token[:20]}...\n")
    
    # Test 2: Use token to fetch board
    print("3. Testing GET /api/user/board with token...")
    result = sp.run(
        ['curl', '-s', '-X', 'GET', 'http://localhost:8000/api/user/board',
         '-H', f'Authorization: Bearer {token}'],
        capture_output=True,
        text=True
    )
    
    board_data = json.loads(result.stdout)
    
    if 'detail' in board_data and '401' in str(board_data.get('detail', '')):
        print(f"   ✗ ERROR 401: {board_data}")
        print("")
        print("   Debugging info:")
        print(f"   - Token was: {token[:30]}...")
        print(f"   - Sent header: Authorization: Bearer {token[:30]}...")
        sys.exit(1)
    
    if 'id' not in board_data:
        print(f"   ✗ ERROR: Unexpected response: {board_data}")
        sys.exit(1)
    
    print(f"   ✓ Board fetched successfully!")
    print(f"   - ID: {board_data['id']}")
    print(f"   - Title: {board_data['title']}")
    print(f"   - Columns: {len(board_data.get('columns', []))}")
    print(f"   - Cards: {len(board_data.get('cards', []))}")
    print("")
    
    print("✅ ALL TESTS PASSED")
    print("")
    print("The authentication flow is working correctly!")
    
finally:
    print("\nCleaning up...")
    server_proc.terminate()
    server_proc.wait(timeout=5)
