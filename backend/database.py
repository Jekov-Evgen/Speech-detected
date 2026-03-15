import sqlite3
import os
from datetime import datetime


def _data_dir():
    d = os.environ.get("SPEECHDETECT_DATA_DIR")
    if d:
        os.makedirs(d, exist_ok=True)
        return d
    return os.path.dirname(__file__)


DB_PATH = os.path.join(_data_dir(), "speechdetect.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filesize INTEGER NOT NULL,
            transcript TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def add_record(filename: str, filepath: str, filesize: int, transcript: str | None = None) -> int:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO history (filename, filepath, filesize, transcript, created_at) VALUES (?, ?, ?, ?, ?)",
        (filename, filepath, filesize, transcript, datetime.now().isoformat()),
    )
    conn.commit()
    record_id = cur.lastrowid
    conn.close()
    return record_id


def update_transcript(record_id: int, transcript: str):
    conn = get_connection()
    conn.execute("UPDATE history SET transcript = ? WHERE id = ?", (transcript, record_id))
    conn.commit()
    conn.close()


def get_all_records() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM history ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_record(record_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM history WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()