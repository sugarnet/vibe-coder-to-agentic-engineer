# Kanban MVP - Database Schema

## Overview

SQLite local database designed to support multiple users, one board per user (MVP), with columns, cards, and chat history. Schema supports future expansion to multiple boards per user and multi-user collaboration.

## Design Rationale

- **SQLite**: Local, zero-setup, ideal for MVP. File-based, suitable for development and small deployments.
- **Normalized Design**: Eliminates data duplication, makes querying flexible, facilitates AI context without redundancy.
- **Foreign Keys**: Enforces referential integrity. Enables cascading deletes (delete user → delete board → delete columns → delete cards).
- **Position Fields**: Allows custom sort order independent of ID, required for drag-drop UI persistence.
- **Timestamps**: Track creation and modification for audit trails, future sync/conflict resolution.

## Schema Diagram (ERD)

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ username        │
│ created_at      │
└────────┬────────┘
         │
         │ (1:1 MVP)
         │
         ▼
┌─────────────────┐
│     boards      │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ title           │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ (1:M)
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐      ┌──────────────────────┐
│    columns      │      │     chat_history     │
├─────────────────┤      ├──────────────────────┤
│ id (PK)         │      │ id (PK)              │
│ board_id (FK)   │      │ board_id (FK)        │
│ title           │      │ role (user/assistant)│
│ position        │      │ content              │
│ created_at      │      │ created_at           │
└────────┬────────┘      └──────────────────────┘
         │
         │ (1:M)
         │
         ▼
┌─────────────────┐
│     cards       │
├─────────────────┤
│ id (PK)         │
│ column_id (FK)  │
│ title           │
│ details         │
│ position        │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

## DDL (Data Definition Language)

### users table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
```

**Columns:**

- `id`: Unique identifier (auto-increment)
- `username`: Unique username (login identifier)
- `created_at`: Account creation timestamp

**Rationale:**

- Simple 1:1 user table for MVP
- Future: Add `email`, `password_hash`, `updated_at` for real auth
- Username index for fast login lookups

---

### boards table

```sql
CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT DEFAULT 'My Board',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_boards_user_id ON boards(user_id);
```

**Columns:**

- `id`: Unique board identifier
- `user_id`: References user (foreign key, cascade delete)
- `title`: Board name (future: support rename)
- `created_at`: Board creation timestamp
- `updated_at`: Last modification timestamp

**Rationale:**

- One board per user for MVP (enforced by app logic, not DB constraint)
- Foreign key ensures no orphaned boards
- Cascade delete: deleting a user deletes all their boards, columns, cards
- `updated_at` useful for conflict resolution / sync

---

### columns table

```sql
CREATE TABLE columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX idx_columns_board_id ON columns(board_id);
CREATE INDEX idx_columns_board_position ON columns(board_id, position);
```

**Columns:**

- `id`: Unique column identifier
- `board_id`: References board (cascade delete)
- `title`: Column name (e.g., "To Do", "In Progress", "Done")
- `position`: Sort order (0-indexed, allows reordering)
- `created_at`: Column creation timestamp

**Rationale:**

- Position field lets frontend customize order (not relying on ID alone)
- Composite index on (board_id, position) speeds up "fetch all columns for board in order"
- Foreign key ensures columns can't exist without a board

---

### cards table

```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_column_position ON cards(column_id, position);
```

**Columns:**

- `id`: Unique card identifier
- `column_id`: References column (cascade delete)
- `title`: Card title (required)
- `details`: Card description (optional, supports markdown)
- `position`: Sort order within column (for drag-drop)
- `created_at`: Card creation timestamp
- `updated_at`: Last modification timestamp

**Rationale:**

- Composite index on (column_id, position) for efficient "fetch cards in column, sorted"
- Cascade delete: deleting column deletes all cards
- `details` allows rich descriptions (future: support Markdown rendering)
- `updated_at` tracks when card was last changed (useful for sync)

---

### chat_history table

```sql
CREATE TABLE chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_history_board ON chat_history(board_id, created_at DESC);
```

**Columns:**

- `id`: Unique message identifier
- `board_id`: References board (cascade delete)
- `role`: "user" or "assistant" (enum-like constraint)
- `content`: Raw message text (or JSON for structured responses)
- `created_at`: Message timestamp

**Rationale:**

- Stores conversation history for AI context
- Composite index on (board_id, created_at DESC) for efficient "fetch last N messages for this board"
- Future: Add fields like `tokens_used`, `model_version` for monitoring

---

## Example API Payloads

### Get User Board

**Request:**

```http
GET /api/user/board
Authorization: Bearer {token}
```

**Response:**

```json
{
  "board": {
    "id": 1,
    "title": "My Board",
    "user_id": 1,
    "columns": [
      {
        "id": 1,
        "title": "To Do",
        "position": 0,
        "cards": [
          {
            "id": 10,
            "title": "Design login screen",
            "details": "Implement OAuth2 flow",
            "position": 0,
            "created_at": "2026-04-15T10:30:00Z",
            "updated_at": "2026-04-15T10:30:00Z"
          },
          {
            "id": 11,
            "title": "Setup database",
            "details": "SQLite on local machine",
            "position": 1,
            "created_at": "2026-04-15T11:00:00Z",
            "updated_at": "2026-04-15T11:00:00Z"
          }
        ]
      },
      {
        "id": 2,
        "title": "In Progress",
        "position": 1,
        "cards": [
          {
            "id": 12,
            "title": "Implement Kanban UI",
            "details": "React component with drag-drop",
            "position": 0,
            "created_at": "2026-04-15T09:00:00Z",
            "updated_at": "2026-04-15T12:00:00Z"
          }
        ]
      }
    ]
  }
}
```

### Create Card

**Request:**

```http
POST /api/cards
Authorization: Bearer {token}
Content-Type: application/json

{
  "column_id": 1,
  "title": "Write unit tests",
  "details": "Aim for 80% coverage"
}
```

**Response:**

```json
{
  "id": 13,
  "column_id": 1,
  "title": "Write unit tests",
  "details": "Aim for 80% coverage",
  "position": 2,
  "created_at": "2026-04-15T13:00:00Z",
  "updated_at": "2026-04-15T13:00:00Z"
}
```

### Update Board (Bulk Update)

**Request:**

```http
PUT /api/board
Authorization: Bearer {token}
Content-Type: application/json

{
  "columns": [
    {
      "id": 1,
      "title": "Todo",
      "position": 0
    },
    {
      "id": 2,
      "title": "Doing",
      "position": 1
    }
  ],
  "cards": [
    {
      "id": 10,
      "column_id": 2,
      "title": "Design login screen",
      "details": "Implement OAuth2 flow",
      "position": 1
    },
    {
      "id": 11,
      "column_id": 1,
      "title": "Setup database",
      "details": "SQLite on local machine",
      "position": 0
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "board_id": 1,
  "columns_updated": 2,
  "cards_updated": 2
}
```

### Chat Message

**Request:**

```http
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Create 3 tasks for the design phase"
}
```

**Response:**

```json
{
  "id": 5,
  "role": "assistant",
  "content": "I've created three design tasks in the \"To Do\" column: UI mockups, component library setup, and design system documentation.",
  "board_updates": {
    "cards": [
      { "id": 20, "column_id": 1, "title": "UI mockups", "position": 3 },
      { "id": 21, "column_id": 1, "title": "Component library", "position": 4 },
      { "id": 22, "column_id": 1, "title": "Design system", "position": 5 }
    ]
  }
}
```

---

## Sample Queries

### Fetch Complete Board for User

```sql
SELECT
  b.id, b.title, b.user_id,
  c.id as col_id, c.title as col_title, c.position as col_pos,
  ca.id as card_id, ca.title as card_title, ca.details, ca.position as card_pos,
  ca.created_at as card_created, ca.updated_at as card_updated
FROM boards b
LEFT JOIN columns c ON c.board_id = b.id
LEFT JOIN cards ca ON ca.column_id = c.id
WHERE b.user_id = ?
ORDER BY c.position, ca.position;
```

### Get Chat History for Board

```sql
SELECT id, role, content, created_at
FROM chat_history
WHERE board_id = ?
ORDER BY created_at DESC
LIMIT 50;
```

### Move Card to Different Column

```sql
BEGIN TRANSACTION;
UPDATE cards SET column_id = ?, position = ? WHERE id = ?;
UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND id != ?;
COMMIT;
```

### Delete Card and Reorder

```sql
BEGIN TRANSACTION;
DELETE FROM cards WHERE id = ?;
UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?;
COMMIT;
```

### Get Chat Context for AI (Last 10 Messages)

```sql
SELECT role, content, created_at
FROM chat_history
WHERE board_id = ?
ORDER BY created_at DESC
LIMIT 10;
```

---

## Migration Strategy

### Auto-Create on Startup

When backend starts, it will:

1. Check if SQLite file exists (default: `kanban.db`)
2. If not, create fresh with all tables and indexes
3. If exists, verify schema version (future-proof for migrations)

Example (Python with sqlite3):

```python
import sqlite3
from pathlib import Path

DB_PATH = Path("kanban.db")

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Execute DDL
    cursor.executescript(DDL_SQL)

    conn.commit()
    conn.close()

if not DB_PATH.exists():
    init_db()
```

### Future Migrations

For schema changes:

- Add versioning table: `schema_version` (records applied migrations)
- Create migration files: `migrations/001_initial.sql`, `002_add_email.sql`, etc.
- On startup, apply any unapplied migrations

---

## Constraints & Validations

### Business Logic Constraints

| Constraint               | Type                | Enforced | Notes                                           |
| ------------------------ | ------------------- | -------- | ----------------------------------------------- |
| One board per user (MVP) | App logic           | Yes      | DB allows multiple, but app creates only 1      |
| Username uniqueness      | DB (UNIQUE)         | Yes      | Prevents duplicate users                        |
| Foreign key integrity    | DB (FK constraints) | Yes      | SQLite with `PRAGMA foreign_keys ON`            |
| Non-empty titles         | App validation      | Yes      | Python model validates before insert            |
| Position consistency     | App logic           | Yes      | App ensures contiguous positions (0, 1, 2, ...) |
| Chat role validation     | DB (CHECK)          | Yes      | Only "user" or "assistant" allowed              |

---

## Performance Considerations

### Indexes

| Table        | Index                       | Reason                            |
| ------------ | --------------------------- | --------------------------------- |
| users        | (username)                  | Fast auth lookups                 |
| boards       | (user_id)                   | Fetch user's board(s)             |
| columns      | (board_id, position)        | Fetch columns in order for UI     |
| cards        | (column_id, position)       | Fetch cards in column, sorted     |
| chat_history | (board_id, created_at DESC) | Fetch recent messages for context |

### N+1 Query Prevention

- Fetch full board (columns + cards) with single LEFT JOIN query
- Avoid separate queries per column / per card
- Use batch updates for drag-drop (single UPDATE with transaction)

### Query Limits

- Fetch max 50 chat messages per request (pagination)
- Fetch columns + cards together (not separate requests)
- Cache card positions in memory during session (write on save)

---

## Future Extensions (Out of MVP Scope)

- **Multi-board per user**: Remove unique constraint on boards.user_id
- **Shared boards**: Add `board_collaborators` junction table
- **Card labels/tags**: Add `card_tags` junction table
- **Activity log**: Audit table tracking all changes
- **Soft deletes**: Add `deleted_at` for recovery instead of cascading delete
- **Attachments**: Store file URLs in cards
- **Real auth**: Add `password_hash`, `email_verified`, `oauth_tokens` tables

---

## Sign-Off

**Schema created**: 2026-04-16  
**Target coverage**: Supports all MVP features (users, boards, columns, cards, chat)  
**Status**: ⏳ Awaiting user review and approval
