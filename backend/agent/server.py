from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from pathlib import Path

from aiohttp import web
from aiohttp.client_exceptions import ClientConnectionResetError

from agent.chat import ChatSession
from agent.chat_store import ChatStore
from agent.confirmations import ConfirmationManager, QuestionManager
from agent.llm_client import OpenAIClient
from agent.logger import info, success, warn
from agent.logger import request as log_request
from agent.memory.aggregator import MemoryAggregator
from agent.memory.store import MemoryStore
from agent.tools import _cleanup_old_screenshots, _get_screenshot_dir


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
        self.auto_mode: bool = False
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

    def set_auto_mode(self, enabled: bool) -> None:
        self.auto_mode = enabled


def _get_backend(request: web.Request) -> Backend:
    return request.app["backend"]


async def health(request: web.Request) -> web.Response:
    log_request("GET", "/health", 200)
    return web.Response(text="ok")


async def reset(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    backend.confirmation_manager.cancel_all()
    backend.question_manager.cancel_all()
    if backend.llm is not None:
        backend._save_active_history()
        backend._new_chat(finalize_current=False)
    try:
        _cleanup_old_screenshots(_get_screenshot_dir(), max_age_seconds=0)
    except Exception:
        pass
    log_request("POST", "/reset", 200)
    info("session reset")
    return web.Response(text="ok")


async def set_mode(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    backend.set_auto_mode(bool(data.get("auto", False)))
    mode = "AUTO" if backend.auto_mode else "SAFE"
    log_request("POST", "/mode", 200)
    info(f"mode changed to {mode}")
    return web.Response(text="ok")


async def status(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = {
        "model": backend.model,
        "provider": "openrouter",
        "connected": backend.llm is not None,
        "mode": "auto" if backend.auto_mode else "ask",
        "cwd": os.getcwd(),
        "token_count": backend.chat.token_count if backend.chat else 0,
        "token_limit": backend.chat.token_limit if backend.chat else 0,
    }
    log_request("GET", "/status", 200)
    return web.json_response(data)


async def chats_list(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    log_request("GET", "/chats", 200)
    return web.json_response(
        {
            "chats": backend.chat_store.list_chats(),
            "active_chat_id": backend.chat.session_id if backend.chat is not None else None,
        }
    )


async def chat_new(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    if backend.llm is None:
        log_request("POST", "/chats/new", 400)
        return web.json_response({"error": "not connected"}, status=400)
    backend.confirmation_manager.cancel_all()
    backend.question_manager.cancel_all()
    backend._save_active_history()
    backend._new_chat(persist=True)
    backend.chat_store.set_model(backend.chat.session_id, backend.model)
    chat = backend.chat_store.get_chat(backend.chat.session_id)
    log_request("POST", "/chats/new", 200)
    return web.json_response({"chat": chat})


async def chat_select(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    if backend.llm is None:
        log_request("POST", "/chats/select", 400)
        return web.json_response({"error": "not connected"}, status=400)
    data = await request.json()
    session_id = data.get("id", "")
    record = backend.chat_store.get_chat(session_id)
    if record is None:
        log_request("POST", "/chats/select", 404)
        return web.json_response({"error": "chat not found"}, status=404)
    backend.confirmation_manager.cancel_all()
    backend.question_manager.cancel_all()
    backend._save_active_history()
    backend._new_chat(
        session_id=record["id"],
        history=record["history"],
        finalize_current=False,
    )
    log_request("POST", "/chats/select", 200)
    return web.json_response({"chat": record})


async def chat_rename(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    session_id = data.get("id", "")
    title = str(data.get("title", "")).strip()
    if not session_id or not title:
        log_request("POST", "/chats/rename", 400)
        return web.json_response({"error": "id and title required"}, status=400)
    ok = backend.chat_store.rename_chat(session_id, title)
    if not ok:
        log_request("POST", "/chats/rename", 404)
        return web.json_response({"error": "chat not found"}, status=404)
    log_request("POST", "/chats/rename", 200)
    return web.json_response({"ok": True})


async def chat_delete(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    session_id = data.get("id", "")
    if not session_id:
        log_request("POST", "/chats/delete", 400)
        return web.json_response({"error": "id required"}, status=400)
    deleted = backend.chat_store.delete_chat(session_id)
    if not deleted:
        log_request("POST", "/chats/delete", 404)
        return web.json_response({"error": "chat not found"}, status=404)
    if backend.chat is not None and backend.chat.session_id == session_id:
        backend.confirmation_manager.cancel_all()
        backend.question_manager.cancel_all()
        backend._new_chat(finalize_current=False)
    log_request("POST", "/chats/delete", 200)
    return web.json_response(
        {
            "ok": True,
            "active_chat_id": backend.chat.session_id if backend.chat is not None else None,
        }
    )


async def chat_blocks_save(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    session_id = data.get("id", "")
    blocks = data.get("blocks", [])
    if not session_id:
        log_request("POST", "/chats/blocks", 400)
        return web.json_response({"error": "id required"}, status=400)
    if not isinstance(blocks, list):
        log_request("POST", "/chats/blocks", 400)
        return web.json_response({"error": "blocks must be a list"}, status=400)
    backend.chat_store.set_blocks(session_id, blocks)
    log_request("POST", "/chats/blocks", 200)
    return web.Response(text="ok")


async def shutdown_handler(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    backend.confirmation_manager.cancel_all()
    backend.question_manager.cancel_all()
    if backend.chat is not None and backend.memory_store is not None:
        MemoryAggregator.finalize(backend.memory_store, backend.chat.session_id)
    log_request("POST", "/shutdown", 200)
    info("graceful shutdown requested")
    shutdown_event = request.app.get("shutdown_event")
    if shutdown_event is not None:
        asyncio.get_event_loop().call_soon(shutdown_event.set)
    return web.Response(text="ok")


async def compact_handler(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    if backend.chat is None:
        return web.json_response({"error": "not connected"}, status=400)
    log_request("POST", "/compact")
    result = await backend.chat.compact()
    info(f"compacted: {result['tokens_before']} → {result['tokens_after']} tokens")
    return web.json_response(result)


async def memory_state_get(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    stats = backend.memory_store.get_stats()
    log_request("GET", "/memory/state", 200)
    return web.json_response(stats)


async def memory_state_post(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    enabled = bool(data.get("enabled", False))
    backend.memory_store.set_enabled(enabled)
    log_request("POST", "/memory/state", 200)
    return web.json_response({"enabled": enabled})


async def memory_clear(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    count = backend.memory_store.clear_entries()
    log_request("POST", "/memory/clear", 200)
    return web.json_response({"cleared": count})


async def memory_snapshot(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    snap = backend.memory_store.get_latest_snapshot()
    log_request("GET", "/memory/snapshot", 200)
    return web.json_response(snap or {})


async def question_handler(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    call_id = data.get("id", "")
    answers = data.get("answers")
    resolved = backend.question_manager.resolve(call_id, answers)
    if resolved:
        log_request("POST", "/question", 200)
        info(f"questions answered: {call_id}")
        return web.Response(text="ok")
    log_request("POST", "/question", 404)
    return web.Response(status=404, text="not found")


async def models_list(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    if backend.llm is None:
        return web.json_response({"models": [], "current": "", "error": "not connected"})
    error = ""
    try:
        models = await backend.llm.list_models()
    except Exception as e:
        warn(f"list_models failed: {e}")
        error = str(e)
        models = []
    log_request("GET", "/models", 200)
    return web.json_response({"models": models, "current": backend.model, "error": error})


async def model_set(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    model = data.get("model", "").strip()
    if not model:
        return web.Response(status=400, text="model required")
    backend.model = model
    if backend.llm is not None and backend.chat is not None:
        backend._save_active_history()
        if backend.chat_store and backend.chat.session_id:
            backend.chat_store.set_model(backend.chat.session_id, model)
        backend.chat.model = model
    info(f"model changed to {model}")
    log_request("POST", "/model/set", 200)
    return web.Response(text="ok")


async def connect_handler(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    api_key = data.get("api_key", "").strip()

    if not api_key:
        return web.json_response({"ok": False, "error": "api key is required"})

    try:
        test_client = OpenAIClient(backend.api_url, api_key=api_key)
        models = await asyncio.wait_for(test_client.list_models(), timeout=10.0)
    except TimeoutError:
        return web.json_response(
            {"ok": False, "error": "connection timed out — check your internet"}
        )
    except Exception as e:
        msg = str(e).lower()
        if any(
            x in msg
            for x in (
                "401",
                "unauthorized",
                "api key",
                "authentication",
                "invalid_api_key",
                "forbidden",
            )
        ):
            return web.json_response(
                {"ok": False, "error": "invalid api key — check it at openrouter.ai/keys"}
            )
        return web.json_response(
            {"ok": False, "error": "could not reach openrouter — check your internet"}
        )

    model = backend.model or (models[0] if models else "")
    backend._init_openrouter(api_key, model)

    log_request("POST", "/connect", 200)
    info(f"connected: openrouter / {model or 'no model'}")
    return web.json_response({"ok": True})


async def tools_list(request: web.Request) -> web.Response:
    from agent.tools import REGISTRY

    log_request("GET", "/tools", 200)
    return web.json_response({"tools": list(REGISTRY.keys())})


async def skills_list(request: web.Request) -> web.Response:
    from agent.skills import discover_skills

    skills = discover_skills()
    log_request("GET", "/skills", 200)
    return web.json_response(
        {
            "skills": [
                {
                    "name": s.name,
                    "description": s.description,
                    "location": s.location,
                    "content": s.content,
                }
                for s in skills
            ]
        }
    )


async def skill_get(request: web.Request) -> web.Response:
    from agent.skills import _validate_name, find_skill, wrap_skill_content

    name = request.match_info.get("name", "")
    if not _validate_name(name):
        log_request("GET", f"/skill/{name}", 400)
        return web.json_response({"error": "invalid skill name"}, status=400)
    skill = find_skill(name)
    if skill is None:
        log_request("GET", f"/skill/{name}", 404)
        return web.json_response({"error": "skill not found"}, status=404)
    log_request("GET", f"/skill/{name}", 200)
    return web.json_response(
        {
            "name": skill.name,
            "content": wrap_skill_content(skill),
        }
    )


async def skill_create(request: web.Request) -> web.Response:
    from agent.skills import _skill_to_dict, _validate_name, create_skill

    data = await request.json()
    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    content = str(data.get("content", ""))
    if not name or not description or not content:
        log_request("POST", "/skills/create", 400)
        return web.json_response({"error": "name, description and content required"}, status=400)
    if not _validate_name(name):
        log_request("POST", "/skills/create", 400)
        return web.json_response({"error": "invalid skill name"}, status=400)
    skill = create_skill(name, description, content)
    if skill is None:
        log_request("POST", "/skills/create", 409)
        return web.json_response({"error": "skill already exists or content too large"}, status=409)
    log_request("POST", "/skills/create", 200)
    return web.json_response({"skill": _skill_to_dict(skill, include_content=True)})


async def skill_update(request: web.Request) -> web.Response:
    from agent.skills import _skill_to_dict, _validate_name, update_skill

    data = await request.json()
    name = str(data.get("name", "")).strip()
    description = data.get("description")
    content = data.get("content")
    if not name:
        log_request("POST", "/skills/update", 400)
        return web.json_response({"error": "name required"}, status=400)
    if not _validate_name(name):
        log_request("POST", "/skills/update", 400)
        return web.json_response({"error": "invalid skill name"}, status=400)
    if description is not None:
        description = str(description).strip()
    if content is not None and not isinstance(content, str):
        log_request("POST", "/skills/update", 400)
        return web.json_response({"error": "content must be a string"}, status=400)
    skill = update_skill(name, description, content)
    if skill is None:
        log_request("POST", "/skills/update", 404)
        return web.json_response({"error": "skill not found or not a user skill"}, status=404)
    log_request("POST", "/skills/update", 200)
    return web.json_response({"skill": _skill_to_dict(skill, include_content=True)})


async def skill_delete(request: web.Request) -> web.Response:
    from agent.skills import _validate_name, delete_skill

    data = await request.json()
    name = str(data.get("name", "")).strip()
    if not name:
        log_request("POST", "/skills/delete", 400)
        return web.json_response({"error": "name required"}, status=400)
    if not _validate_name(name):
        log_request("POST", "/skills/delete", 400)
        return web.json_response({"error": "invalid skill name"}, status=400)
    ok = delete_skill(name)
    if not ok:
        log_request("POST", "/skills/delete", 404)
        return web.json_response({"error": "skill not found or not a user skill"}, status=404)
    log_request("POST", "/skills/delete", 200)
    return web.json_response({"ok": True})


async def confirm(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    data = await request.json()
    call_id = data.get("id", "")
    ok = bool(data.get("ok", False))
    resolved = backend.confirmation_manager.resolve(call_id, ok)
    if resolved:
        log_request("POST", "/confirm", 200)
        action = "confirmed" if ok else "cancelled"
        info(f"action {action}")
        return web.Response(text="ok")
    log_request("POST", "/confirm", 404)
    warn(f"confirm not found: {call_id}")
    return web.Response(status=404, text="not found")


def _client_disconnected(request: web.Request) -> bool:
    transport = request.transport
    return transport is not None and transport.is_closing()


def _fallback_title(text: str) -> str:
    title = " ".join(text.strip().split())
    if len(title) > 64:
        title = title[:61].rstrip() + "..."
    return title or "New Chat"


@web.middleware
async def _cors_middleware(request: web.Request, handler):
    # short-circuit preflight before routing so any path is allowed
    if request.method == "OPTIONS":
        return web.Response(status=200)
    return await handler(request)


async def _cors_headers(request: web.Request, response: web.StreamResponse) -> None:
    # runs right before headers flush — works for streamed NDJSON responses too
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"


def _get_upload_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TEMP") or str(Path.home())
    dir_path = Path(base) / "warden" / "uploads"
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


async def upload_handler(request: web.Request) -> web.Response:
    backend = _get_backend(request)
    reader = await request.multipart()
    files = []
    upload_dir = _get_upload_dir()
    while True:
        field = await reader.next()
        if field is None:
            break
        if field.name != "files":
            continue
        filename = field.filename or f"untitled_{uuid.uuid4().hex[:8]}"
        safe_name = f"{uuid.uuid4().hex}_{filename}"
        dest = upload_dir / safe_name
        with open(dest, "wb") as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                f.write(chunk)
        content_type = (
            field.headers.get("Content-Type", "application/octet-stream")
            if hasattr(field, "headers")
            else "application/octet-stream"
        )
        files.append(
            {
                "id": safe_name,
                "name": filename,
                "type": content_type,
                "path": str(dest),
            }
        )
    log_request("POST", "/upload", 200)
    info(f"uploaded {len(files)} file(s)")
    return web.json_response({"files": files})


async def chat(request: web.Request) -> web.StreamResponse:
    backend = _get_backend(request)
    data = await request.json()
    text = data.get("text", "")
    skill_name = data.get("skill")
    skill_args = data.get("args")
    file_ids = data.get("files", [])
    log_request("POST", "/chat")
    info(f"user: {text[:50]}..." if len(text) > 50 else f"user: {text}")

    response = web.StreamResponse(
        status=200,
        headers={"Content-Type": "application/x-ndjson"},
    )
    await response.prepare(request)

    if backend.chat is None:
        await response.write(
            json.dumps(
                {"type": "error", "text": "not connected — run /connect to get started"},
                ensure_ascii=False,
            ).encode()
            + b"\n"
        )
        await response.write(
            json.dumps({"type": "done", "token_count": 0, "token_limit": 0}).encode() + b"\n"
        )
        return response

    try:
        was_empty = len(backend.chat.history) == 0
        assistant_parts: list[str] = []
        if was_empty and text.strip():
            backend.chat_store.ensure_chat(backend.chat.session_id)
            title = _fallback_title(text)
            backend.chat_store.set_title(backend.chat.session_id, title, "user")
            await response.write(
                (
                    json.dumps(
                        {
                            "type": "title",
                            "chat_id": backend.chat.session_id,
                            "title": title,
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                ).encode()
            )

        files_data = []
        if file_ids:
            upload_dir = _get_upload_dir()
            for fid in file_ids:
                fp = upload_dir / fid
                if fp.exists():
                    with open(fp, "rb") as f:
                        raw = f.read()
                    files_data.append(
                        {
                            "name": fid.split("_", 1)[1] if "_" in fid else fid,
                            "data": base64.b64encode(raw).decode(),
                        }
                    )

        stream_kwargs = {"auto_mode": backend.auto_mode}
        if skill_name:
            stream_kwargs["skill_name"] = skill_name
            stream_kwargs["skill_args"] = skill_args
        if files_data:
            stream_kwargs["files"] = files_data
        stream = backend.chat.stream(text, **stream_kwargs)
        async for type_, payload in stream:
            if _client_disconnected(request):
                backend.confirmation_manager.cancel_all()
                backend.question_manager.cancel_all()
                break
            if type_ == "warden_start":
                msg: dict = {"type": "warden_start"}
            elif type_ in ("token", "think"):
                msg = {"type": type_, "text": payload}
                if type_ == "token":
                    assistant_parts.append(str(payload))
            elif type_ == "tool_start":
                msg = {"type": "tool_start", "name": payload["name"], "args": payload["args"]}
            elif type_ == "tool":
                msg = {
                    "type": "tool",
                    "name": payload["name"],
                    "args": payload["args"],
                    "result": payload["result"],
                }
                if payload.get("diff"):
                    msg["diff"] = payload["diff"]
            elif type_ == "confirm":
                msg = {
                    "type": "confirm",
                    "id": payload["id"],
                    "tool": payload["tool"],
                    "risk": payload.get("risk", "confirm"),
                    "title": payload.get("title", "Dangerous action"),
                    "summary": payload.get("summary", ""),
                    "details": payload.get("details", []),
                    "args": payload["args"],
                    "preview": payload.get("preview", ""),
                    "default": payload.get("default", "cancel"),
                }
            elif type_ == "question":
                msg = {
                    "type": "question",
                    "id": payload["id"],
                    "questions": payload["questions"],
                }
            else:
                continue
            try:
                await response.write((json.dumps(msg, ensure_ascii=False) + "\n").encode())
            except (ConnectionResetError, ClientConnectionResetError):
                break
        backend._save_active_history()
        if not _client_disconnected(request):
            if was_empty:
                title = await backend.chat.generate_title(text, "".join(assistant_parts))
                if title:
                    backend.chat_store.set_title(backend.chat.session_id, title, "llm")
                    await response.write(
                        (
                            json.dumps(
                                {
                                    "type": "title",
                                    "chat_id": backend.chat.session_id,
                                    "title": title,
                                },
                                ensure_ascii=False,
                            )
                            + "\n"
                        ).encode()
                    )
            done_msg = {
                "type": "done",
                "token_count": backend.chat.token_count,
                "token_limit": backend.chat.token_limit,
            }
            await response.write((json.dumps(done_msg) + "\n").encode())
    except (ConnectionResetError, ClientConnectionResetError):
        backend._save_active_history()
        pass
    except Exception as e:
        backend._save_active_history()
        if not _client_disconnected(request):
            try:
                await response.write(
                    (
                        json.dumps({"type": "error", "text": str(e)}, ensure_ascii=False) + "\n"
                    ).encode()
                )
            except (ConnectionResetError, ClientConnectionResetError):
                pass

    return response


async def main() -> Backend:
    info("starting backend...")
    backend = Backend()
    await backend.setup()
    success("remote API ready")

    shutdown_event = asyncio.Event()
    app = web.Application(middlewares=[_cors_middleware])
    app.on_response_prepare.append(_cors_headers)
    app["backend"] = backend
    app["shutdown_event"] = shutdown_event
    app.router.add_get("/health", health)
    app.router.add_post("/reset", reset)
    app.router.add_post("/chat", chat)
    app.router.add_post("/upload", upload_handler)
    app.router.add_post("/confirm", confirm)
    app.router.add_post("/mode", set_mode)
    app.router.add_get("/status", status)
    app.router.add_get("/chats", chats_list)
    app.router.add_post("/chats/new", chat_new)
    app.router.add_post("/chats/select", chat_select)
    app.router.add_post("/chats/rename", chat_rename)
    app.router.add_post("/chats/delete", chat_delete)
    app.router.add_post("/chats/blocks", chat_blocks_save)
    app.router.add_get("/tools", tools_list)
    app.router.add_get("/skills", skills_list)
    app.router.add_get("/skill/{name}", skill_get)
    app.router.add_post("/skills/create", skill_create)
    app.router.add_post("/skills/update", skill_update)
    app.router.add_post("/skills/delete", skill_delete)
    app.router.add_get("/models", models_list)
    app.router.add_post("/model/set", model_set)
    app.router.add_post("/connect", connect_handler)
    app.router.add_post("/question", question_handler)
    app.router.add_post("/compact", compact_handler)
    app.router.add_get("/memory/state", memory_state_get)
    app.router.add_post("/memory/state", memory_state_post)
    app.router.add_post("/memory/clear", memory_clear)
    app.router.add_get("/memory/snapshot", memory_snapshot)
    app.router.add_post("/shutdown", shutdown_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", 8765)
    await site.start()
    success("backend on http://localhost:8765")
    await shutdown_event.wait()
    await runner.cleanup()
    return backend


if __name__ == "__main__":
    backend = None
    try:
        backend = asyncio.run(main())
    except KeyboardInterrupt:
        pass
