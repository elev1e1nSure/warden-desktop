from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import uuid
from pathlib import Path

from aiohttp import web
from aiohttp.client_exceptions import ClientConnectionResetError

from agent.app_state import get_backend
from agent.logger import info
from agent.logger import request as log_request
from agent.memory.aggregator import MemoryAggregator

# File IDs accepted by /chat must match the format produced by /upload:
# `<32 hex chars>_<basename>`. Anything else is rejected before touching disk.
_FILE_ID_RE = re.compile(r"^[a-f0-9]{32}_[^/\\]+$")

# Basename characters that are safe to keep from an uploaded filename.
_SAFE_FILENAME_RE = re.compile(r"[\\/:*?\"<>|\x00-\x1f]")


def _warden_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TEMP") or str(Path.home())
    p = Path(base) / "warden"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _get_upload_dir() -> Path:
    dir_path = _warden_data_dir() / "uploads"
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def _client_disconnected(request: web.Request) -> bool:
    transport = request.transport
    return transport is not None and transport.is_closing()


def _fallback_title(text: str) -> str:
    title = " ".join(text.strip().split())
    if len(title) > 64:
        title = title[:61].rstrip() + "..."
    return title or "New Chat"


async def reset(request: web.Request) -> web.Response:
    from agent.tools import _cleanup_old_screenshots, _get_screenshot_dir

    backend = get_backend(request)
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


async def compact_handler(request: web.Request) -> web.Response:
    backend = get_backend(request)
    if backend.chat is None:
        return web.json_response({"error": "not connected"}, status=400)
    log_request("POST", "/compact")
    result = await backend.chat.compact()
    info(f"compacted: {result['tokens_before']} → {result['tokens_after']} tokens")
    return web.json_response(result)


async def confirm(request: web.Request) -> web.Response:
    from agent.logger import warn

    backend = get_backend(request)
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


async def question_handler(request: web.Request) -> web.Response:
    backend = get_backend(request)
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


async def upload_handler(request: web.Request) -> web.Response:
    reader = await request.multipart()
    files = []
    upload_dir = _get_upload_dir()
    upload_root = upload_dir.resolve()
    while True:
        field = await reader.next()
        if field is None:
            break
        if field.name != "files":
            continue
        filename = field.filename or f"untitled_{uuid.uuid4().hex[:8]}"
        safe_basename = _SAFE_FILENAME_RE.sub("_", os.path.basename(filename)) or "untitled"
        safe_name = f"{uuid.uuid4().hex}_{safe_basename}"
        dest = (upload_dir / safe_name).resolve()
        try:
            dest.relative_to(upload_root)
        except ValueError:
            log_request("POST", "/upload", 400)
            return web.json_response({"error": "invalid filename"}, status=400)
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
    backend = get_backend(request)
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
        if was_empty and (text.strip() or file_ids):
            backend.chat_store.ensure_chat(backend.chat.session_id)
            title = _fallback_title(text)
            if not text.strip() and file_ids:
                first_fid = file_ids[0]
                title = first_fid.split("_", 1)[1] if "_" in first_fid else first_fid
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
            upload_root = upload_dir.resolve()
            for fid in file_ids:
                if not isinstance(fid, str) or not _FILE_ID_RE.match(fid):
                    log_request("POST", "/chat", 400)
                    await response.write(
                        json.dumps(
                            {"type": "error", "text": "invalid file id"},
                            ensure_ascii=False,
                        ).encode()
                        + b"\n"
                    )
                    continue
                fp = (upload_dir / fid).resolve()
                try:
                    fp.relative_to(upload_root)
                except ValueError:
                    continue
                if fp.exists():
                    with open(fp, "rb") as f:
                        raw = f.read()
                    files_data.append(
                        {
                            "name": fid.split("_", 1)[1] if "_" in fid else fid,
                            "data": base64.b64encode(raw).decode(),
                        }
                    )

        stream_kwargs = {
            "auto_mode": backend.auto_mode,
            "permissions": backend.permissions or None,
        }
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
