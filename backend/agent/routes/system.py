from __future__ import annotations

import asyncio
import os

from aiohttp import web

from agent.app_state import get_backend
from agent.logger import info
from agent.logger import request as log_request
from agent.memory.aggregator import MemoryAggregator


async def health(request: web.Request) -> web.Response:
    log_request("GET", "/health", 200)
    return web.Response(text="ok")


async def status(request: web.Request) -> web.Response:
    backend = get_backend(request)
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


async def set_mode(request: web.Request) -> web.Response:
    backend = get_backend(request)
    data = await request.json()
    backend.set_auto_mode(bool(data.get("auto", False)))
    mode = "AUTO" if backend.auto_mode else "SAFE"
    log_request("POST", "/mode", 200)
    info(f"mode changed to {mode}")
    return web.Response(text="ok")


async def permissions_get(request: web.Request) -> web.Response:
    from agent.safety._policy import PERMISSION_GROUPS

    backend = get_backend(request)
    result = {group: backend.permissions.get(group, "ask") for group in PERMISSION_GROUPS}
    log_request("GET", "/permissions", 200)
    return web.json_response(result)


async def permissions_post(request: web.Request) -> web.Response:
    from agent.safety._policy import PERMISSION_GROUPS

    backend = get_backend(request)
    data = await request.json()
    group = data.get("group")
    value = data.get("value")
    if group not in PERMISSION_GROUPS or value not in ("block", "ask", "allow"):
        log_request("POST", "/permissions", 400)
        return web.Response(status=400, text="invalid group or value")
    backend.permissions[group] = value
    backend.save_permissions()
    log_request("POST", "/permissions", 200)
    return web.Response(text="ok")


async def tools_list(request: web.Request) -> web.Response:
    from agent.tools import REGISTRY

    log_request("GET", "/tools", 200)
    return web.json_response({"tools": list(REGISTRY.keys())})


async def shutdown_handler(request: web.Request) -> web.Response:
    backend = get_backend(request)
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
