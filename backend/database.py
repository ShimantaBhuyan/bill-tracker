import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.getenv("DB_PATH", "./bills.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                image_path TEXT NOT NULL,
                category TEXT DEFAULT 'others',
                description TEXT,
                vendor TEXT,
                amount REAL,
                currency TEXT,
                bill_date TEXT,
                notes TEXT,
                analysis_status TEXT DEFAULT 'pending',
                raw_analysis TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_bills_category ON bills(category)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(analysis_status)
        """)


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)
