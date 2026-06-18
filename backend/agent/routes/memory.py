from __future__ import annotations

from aiohttp import web

from agent.app_state import get_backend
from agent.logger import request as log_request


async def memory_state_get(request: web.Request) -> web.Response:
    backend = get_backend(request)
    stats = backend.memory_store.get_stats()
    log_request("GET", "/memory/state", 200)
    return web.json_response(stats)


async def memory_state_post(request: web.Request) -> web.Response:
    backend = get_backend(request)
    data = await request.json()
    enabled = bool(data.get("enabled", False))
    backend.memory_store.set_enabled(enabled)
    log_request("POST", "/memory/state", 200)
    return web.json_response({"enabled": enabled})


async def memory_clear(request: web.Request) -> web.Response:
    backend = get_backend(request)
    count = backend.memory_store.clear_entries()
    log_request("POST", "/memory/clear", 200)
    return web.json_response({"cleared": count})


async def memory_snapshot(request: web.Request) -> web.Response:
    backend = get_backend(request)
    snap = backend.memory_store.get_latest_snapshot()
    log_request("GET", "/memory/snapshot", 200)
    return web.json_response(snap or {})
