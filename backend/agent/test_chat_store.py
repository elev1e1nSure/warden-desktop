from __future__ import annotations

import json
import sqlite3

from agent.chat_store import ChatStore


def test_migrates_legacy_chat_schema(tmp_path):
    db = tmp_path / "chats.db"
    with sqlite3.connect(db) as conn:
        conn.execute(
            """
			CREATE TABLE chats (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				model TEXT NOT NULL DEFAULT '',
				provider TEXT NOT NULL DEFAULT '',
				auto_mode INTEGER NOT NULL DEFAULT 0,
				message_count INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				history_json TEXT NOT NULL
			)
			"""
        )
        conn.execute(
            """
			INSERT INTO chats (
				id, title, model, provider, auto_mode, message_count,
				created_at, updated_at, history_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			""",
            (
                "chat-1",
                "Legacy chat",
                "gpt-4",
                "openrouter",
                0,
                2,
                "2026-06-14 10:00:00",
                "2026-06-14 11:00:00",
                json.dumps(
                    [
                        {"role": "user", "content": "hello"},
                        {"role": "assistant", "content": "hi"},
                    ]
                ),
            ),
        )
        conn.commit()

    store = ChatStore(db)

    chat = store.get_chat("chat-1")
    assert chat is not None
    assert chat["id"] == "chat-1"
    assert chat["title"] == "Legacy chat"
    assert len(chat["history"]) == 2
    assert chat["blocks"][0]["kind"] == "user"
    assert chat["blocks"][1]["kind"] == "assistant"

    chats = store.list_chats()
    assert len(chats) == 1
    assert chats[0]["id"] == "chat-1"

    with sqlite3.connect(db) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(chats)").fetchall()}
    assert "session_id" in cols
    assert "history" in cols
    assert "blocks" in cols


def test_list_chats_uses_creation_order_not_update_order(tmp_path):
    db = tmp_path / "chats.db"
    store = ChatStore(db)
    with sqlite3.connect(db) as conn:
        conn.execute(
            """
			INSERT INTO chats(session_id, title, created_at, updated_at, history, blocks)
			VALUES (?, ?, ?, ?, ?, ?)
			""",
            ("old-chat", "Old", "2026-06-14 10:00:00", "2026-06-14 12:00:00", "[]", "[]"),
        )
        conn.execute(
            """
			INSERT INTO chats(session_id, title, created_at, updated_at, history, blocks)
			VALUES (?, ?, ?, ?, ?, ?)
			""",
            ("new-chat", "New", "2026-06-14 11:00:00", "2026-06-14 11:00:00", "[]", "[]"),
        )
        conn.commit()

    chats = store.list_chats()

    assert [chat["id"] for chat in chats] == ["new-chat", "old-chat"]
