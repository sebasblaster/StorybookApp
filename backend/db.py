"""SQLite persistence (stdlib only: no database server to install).

One connection per operation, WAL mode so the generation worker thread and the API
threads can read/write at the same time. Structured fields are stored as JSON text.
"""
import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from engine.paths import DB_PATH

JSON_FIELDS = ("config", "plan", "scenes", "metrics")
_scene_lock = threading.RLock()  # protects read-modify-write of the scenes JSON

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, idea TEXT NOT NULL, genre TEXT NOT NULL,
    title TEXT, cover TEXT, status TEXT NOT NULL, stage TEXT, progress INTEGER NOT NULL DEFAULT 0,
    error TEXT, favorite INTEGER NOT NULL DEFAULT 0, share_token TEXT UNIQUE, media_key TEXT NOT NULL,
    created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
    config TEXT, plan TEXT, scenes TEXT, metrics TEXT
);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connect():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    with connect() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)


def _decode(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    for f in JSON_FIELDS:
        d[f] = json.loads(d[f]) if d.get(f) else ({} if f in ("config", "plan", "metrics") else [])
    if not d["metrics"]:
        d["metrics"] = None
    d["favorite"] = bool(d["favorite"])
    return d


# ---------------- users ----------------
def create_user(email: str, name: str, password_hash: str) -> dict:
    uid = uuid.uuid4().hex
    with connect() as c:
        c.execute("INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)",
                  (uid, email, name, password_hash, _now()))
    return {"id": uid, "email": email, "name": name}


def user_by_email(email: str) -> dict | None:
    with connect() as c:
        r = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return dict(r) if r else None


def user_by_id(uid: str) -> dict | None:
    with connect() as c:
        r = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return dict(r) if r else None


# ---------------- stories ----------------
def create_story(user_id: str, idea: str, genre: str, config: dict) -> dict:
    sid = uuid.uuid4().hex
    with connect() as c:
        c.execute(
            "INSERT INTO stories (id,user_id,idea,genre,status,stage,progress,media_key,created_at,config,scenes) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (sid, user_id, idea, genre, "queued", "En cola", 0, uuid.uuid4().hex, _now(), json.dumps(config), "[]"),
        )
    return get_story(sid)


def get_story(sid: str, user_id: str | None = None) -> dict | None:
    q, args = "SELECT * FROM stories WHERE id=?", [sid]
    if user_id:
        q, args = q + " AND user_id=?", args + [user_id]
    with connect() as c:
        return _decode(c.execute(q, args).fetchone())


def update_story(sid: str, **fields) -> None:
    if not fields:
        return
    cols, vals = [], []
    for k, v in fields.items():
        cols.append(f"{k}=?")
        if k in JSON_FIELDS:
            v = json.dumps(v, ensure_ascii=False)
        elif k == "favorite":
            v = int(bool(v))
        vals.append(v)
    with connect() as c:
        c.execute(f"UPDATE stories SET {', '.join(cols)} WHERE id=?", [*vals, sid])


def update_scene(sid: str, idx: int, **fields) -> None:
    """Atomically patch one scene (e.g. after regenerating its image)."""
    with _scene_lock:
        s = get_story(sid)
        if not s or idx >= len(s["scenes"]):
            return
        s["scenes"][idx].update(fields)
        update_story(sid, scenes=s["scenes"], **({"cover": s["scenes"][0]["image"]} if idx == 0 and "image" in fields else {}))


def list_stories(user_id: str, limit: int = 200, with_scenes: bool = True) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM stories WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)).fetchall()
    out = [_decode(r) for r in rows]
    if not with_scenes:
        for s in out:
            s["scenes"] = []
    return out


def list_done(user_id: str) -> list[dict]:
    return [s for s in list_stories(user_id, 500, with_scenes=False) if s["status"] == "done"]


def delete_story(sid: str) -> None:
    with connect() as c:
        c.execute("DELETE FROM stories WHERE id=?", (sid,))


def by_share_token(token: str) -> dict | None:
    with connect() as c:
        return _decode(c.execute("SELECT * FROM stories WHERE share_token=? AND status='done'", (token,)).fetchone())


def queue_position(created_at: str) -> int:
    with connect() as c:
        n = c.execute("SELECT COUNT(*) FROM stories WHERE status IN ('queued','generating') AND created_at < ?",
                      (created_at,)).fetchone()[0]
    return n + 1


def pending_ids() -> list[str]:
    with connect() as c:
        rows = c.execute("SELECT id FROM stories WHERE status IN ('queued','generating') ORDER BY created_at").fetchall()
    return [r["id"] for r in rows]
