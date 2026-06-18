from __future__ import annotations

from aiohttp import web

from agent.app_state import get_backend
from agent.logger import request as log_request


async def chats_list(request: web.Request) -> web.Response:
    backend = get_backend(request)
    log_request("GET", "/chats", 200)
    return web.json_response(
        {
            "chats": backend.chat_store.list_chats(),
            "active_chat_id": backend.chat.session_id if backend.chat is not None else None,
        }
    )


async def chat_new(request: web.Request) -> web.Response:
    backend = get_backend(request)
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
    backend = get_backend(request)
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
    backend = get_backend(request)
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
    backend = get_backend(request)
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
    backend = get_backend(request)
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
