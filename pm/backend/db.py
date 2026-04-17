"""Database initialization and connection management."""
from pathlib import Path
import sqlite3
from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Database path
DB_PATH = Path(__file__).parent / "kanban.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine with proper SQLite configuration
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

# Create session factory
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Session:
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable foreign keys for SQLite."""
    if isinstance(dbapi_conn, sqlite3.Connection):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db():
    """Initialize database - create tables if they don't exist."""
    from app.models import Base
    Base.metadata.create_all(bind=engine)
