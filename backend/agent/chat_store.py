from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


def _db_path() -> Path:
    override = os.environ.get("WARDEN_CHAT_DB")
    if override:
        return Path(override)
    return Path.home() / ".warden" / "chats.db"


class ChatStore:
    """SQLite-backed chat/session persistence."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self.db_path))

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
				CREATE TABLE IF NOT EXISTS chats (
					session_id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					title_source TEXT NOT NULL DEFAULT 'manual',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					history TEXT NOT NULL DEFAULT '[]',
					blocks TEXT NOT NULL DEFAULT '[]',
					model TEXT
				)
				"""
            )
            cols = self._table_columns(conn)
            if "session_id" not in cols and "id" in cols:
                self._migrate_legacy_schema(conn)
                cols = self._table_columns(conn)
            for name, ddl in (
                ("title_source", "TEXT NOT NULL DEFAULT 'manual'"),
                ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                ("history", "TEXT NOT NULL DEFAULT '[]'"),
                ("blocks", "TEXT NOT NULL DEFAULT '[]'"),
                ("model", "TEXT"),
            ):
                if name not in cols:
                    conn.execute(f"ALTER TABLE chats ADD COLUMN {name} {ddl}")
            conn.commit()

    def _table_columns(self, conn: sqlite3.Connection) -> set[str]:
        rows = conn.execute("PRAGMA table_info(chats)").fetchall()
        return {row[1] for row in rows}

    def _migrate_legacy_schema(self, conn: sqlite3.Connection) -> None:
        conn.execute("ALTER TABLE chats RENAME TO chats_legacy")
        conn.execute(
            """
			CREATE TABLE chats (
				session_id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				title_source TEXT NOT NULL DEFAULT 'manual',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				history TEXT NOT NULL DEFAULT '[]',
				blocks TEXT NOT NULL DEFAULT '[]',
				model TEXT
			)
			"""
        )
        rows = conn.execute(
            """
			SELECT id, title, created_at, updated_at, history_json
			FROM chats_legacy
			ORDER BY updated_at ASC, created_at ASC
			"""
        ).fetchall()
        for session_id, title, created_at, updated_at, history_json in rows:
            history = history_json or "[]"
            blocks = json.dumps(_history_to_blocks(history), ensure_ascii=False)
            conn.execute(
                """
				INSERT INTO chats (
					session_id, title, title_source, created_at, updated_at, history, blocks
				) VALUES (?, ?, ?, ?, ?, ?, ?)
				""",
                (
                    session_id,
                    title or "New Chat",
                    "manual",
                    created_at,
                    updated_at,
                    history,
                    blocks,
                ),
            )
        conn.execute("DROP TABLE chats_legacy")

    def ensure_chat(self, session_id: str, title: str = "New Chat") -> None:
        with self._conn() as conn:
            conn.execute(
                """
				INSERT OR IGNORE INTO chats(session_id, title)
				VALUES (?, ?)
				""",
                (session_id, title),
            )
            conn.commit()

    def save_chat(
        self,
        session_id: str,
        *,
        title: str | None = None,
        title_source: str | None = None,
        history: list[dict[str, Any]] | None = None,
        blocks: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> None:
        self.ensure_chat(session_id)
        sets = ["updated_at = CURRENT_TIMESTAMP"]
        params: list[Any] = []
        if title is not None:
            sets.append("title = ?")
            params.append(title)
        if title_source is not None:
            sets.append("title_source = ?")
            params.append(title_source)
        if history is not None:
            sets.append("history = ?")
            params.append(json.dumps(history, ensure_ascii=False))
        if blocks is not None:
            sets.append("blocks = ?")
            params.append(json.dumps(blocks, ensure_ascii=False))
        if model is not None:
            sets.append("model = ?")
            params.append(model)
        params.append(session_id)
        with self._conn() as conn:
            conn.execute(
                f"UPDATE chats SET {', '.join(sets)} WHERE session_id = ?",
                params,
            )
            conn.commit()

    def set_title(self, session_id: str, title: str, source: str) -> None:
        self.save_chat(session_id, title=title, title_source=source)

    def set_blocks(self, session_id: str, blocks: list[dict[str, Any]]) -> None:
        self.save_chat(session_id, blocks=blocks)

    def set_model(self, session_id: str, model: str) -> None:
        self.save_chat(session_id, model=model)

    def rename_chat(self, session_id: str, title: str) -> bool:
        title = title.strip()
        if not title:
            return False
        with self._conn() as conn:
            cur = conn.execute(
                """
				UPDATE chats
				SET title = ?, title_source = 'manual', updated_at = CURRENT_TIMESTAMP
				WHERE session_id = ?
				""",
                (title, session_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def delete_chat(self, session_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute("DELETE FROM chats WHERE session_id = ?", (session_id,))
            conn.commit()
            return cur.rowcount > 0

    def get_chat(self, session_id: str) -> dict[str, Any] | None:
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
				SELECT session_id, title, title_source, created_at, updated_at, history, blocks, model
				FROM chats
				WHERE session_id = ?
				""",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return self._decode_row(row)

    def list_chats(self) -> list[dict[str, Any]]:
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
				SELECT session_id, title, title_source, created_at, updated_at, history, blocks, model
				FROM chats
				ORDER BY created_at DESC, session_id DESC
				"""
            ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            chat = self._decode_row(row)
            if (
                not chat.get("history")
                and not chat.get("blocks")
                and str(chat.get("title", "")).strip().lower() == "new chat"
            ):
                continue
            result.append({k: v for k, v in chat.items() if k not in {"history", "blocks"}})
        return result

    def _decode_row(
        self,
        row: sqlite3.Row,
        *,
        include_payload: bool = True,
    ) -> dict[str, Any]:
        data = {
            "id": row["session_id"],
            "title": row["title"],
            "title_source": row["title_source"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "timestamp": _display_time(row["updated_at"]),
            "model": row["model"],
        }
        if include_payload:
            data["history"] = _loads(row["history"])
            data["blocks"] = _loads(row["blocks"])
        return data


def _loads(raw: str) -> list[dict[str, Any]]:
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except json.JSONDecodeError:
        return []


def _history_to_blocks(history_json: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for msg in _loads(history_json):
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        content = msg.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        if role == "user":
            blocks.append({"id": _block_id(len(blocks)), "kind": "user", "text": content})
        elif role == "assistant":
            blocks.append({"id": _block_id(len(blocks)), "kind": "assistant", "text": content})
        elif role == "tool":
            blocks.append(
                {
                    "id": _block_id(len(blocks)),
                    "kind": "tool",
                    "name": str(msg.get("name", "tool")),
                    "args": "",
                    "result": content,
                    "status": "done",
                }
            )
    return blocks


def _block_id(idx: int) -> str:
    return f"legacy-{idx + 1}"


def _display_time(value: str) -> str:
    parts = value.split()
    if len(parts) >= 2:
        return parts[1][:5]
    return value[:16]
