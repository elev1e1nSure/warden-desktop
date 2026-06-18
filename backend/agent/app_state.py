from __future__ import annotations

import json
import os
from pathlib import Path

from aiohttp import web

from agent.chat import ChatSession
from agent.chat_store import ChatStore
from agent.confirmations import ConfirmationManager, QuestionManager
from agent.llm_client import OpenAIClient
from agent.logger import warn
from agent.memory.aggregator import MemoryAggregator
from agent.memory.store import MemoryStore
from agent.tools import _cleanup_old_screenshots, _get_screenshot_dir


def _warden_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TEMP") or str(Path.home())
    p = Path(base) / "warden"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _auth_token_path() -> Path:
    return _warden_data_dir() / ".token"


def _permissions_path() -> Path:
    return _warden_data_dir() / "permissions.json"


class Backend:
    def __init__(self) -> None:
        try:
            _cleanup_old_screenshots(_get_screenshot_dir(), max_age_seconds=0)
        except Exception:
            pass
        self.model: str = os.environ.get("WARDEN_MODEL", "")
        self.api_url: str = os.environ.get("WARDEN_API_URL", "https://openrouter.ai/api/v1")
        self.api_key: str = os.environ.get("OPENROUTER_API_KEY", "")
        self.llm: OpenAIClient | None = None
        self.chat: ChatSession | None = None
        self.mode: str = "ask"  # "ask" | "auto" | "custom"
        self.permissions: dict[str, str] = self._load_permissions()
        self.confirmation_manager = ConfirmationManager()
        self.question_manager = QuestionManager()
        self.memory_store = MemoryStore()
        self.chat_store = ChatStore()
        if self.api_key:
            self._init_openrouter(self.api_key, self.model)

    def _new_chat(
        self,
        session_id: str | None = None,
        history: list[dict] | None = None,
        persist: bool = False,
        finalize_current: bool = True,
    ) -> None:
        if finalize_current and self.chat is not None and self.memory_store is not None:
            MemoryAggregator.finalize(self.memory_store, self.chat.session_id)
        if self.llm is None:
            self.chat = None
            return
        self.chat = ChatSession(
            model=self.model,
            client=self.llm,
            confirmation_manager=self.confirmation_manager,
            question_manager=self.question_manager,
            memory_store=self.memory_store,
            session_id=session_id,
            history=history,
        )
        if persist:
            self.chat_store.ensure_chat(self.chat.session_id)

    def _save_active_history(self) -> None:
        if self.chat is not None:
            self.chat_store.save_chat(self.chat.session_id, history=self.chat.history)

    def _init_openrouter(self, api_key: str, model: str) -> None:
        self.llm = OpenAIClient(self.api_url, api_key=api_key or None)
        self.api_key = api_key
        self.model = model
        self._new_chat()

    async def setup(self) -> None:
        return

    @property
    def auto_mode(self) -> bool:
        return self.mode == "auto"

    def set_auto_mode(self, enabled: bool) -> None:
        self.mode = "auto" if enabled else "ask"

    def set_mode(self, mode: str) -> None:
        if mode in ("ask", "auto", "custom"):
            self.mode = mode

    def _load_permissions(self) -> dict[str, str]:
        p = _permissions_path()
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def save_permissions(self) -> None:
        try:
            _permissions_path().write_text(json.dumps(self.permissions), encoding="utf-8")
        except Exception as e:
            warn(f"could not save permissions: {e}")


def get_backend(request: web.Request) -> Backend:
    return request.app["backend"]
