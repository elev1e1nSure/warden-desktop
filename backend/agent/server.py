from __future__ import annotations

import asyncio
import secrets

from aiohttp import web

from agent.app_state import Backend, _auth_token_path, _warden_data_dir
from agent.logger import info, success, warn
from agent.logger import request as log_request
from agent.routes.chat import (
    chat,
    compact_handler,
    confirm,
    question_handler,
    reset,
    upload_handler,
)
from agent.routes.chats import (
    chat_blocks_save,
    chat_delete,
    chat_new,
    chat_rename,
    chat_select,
    chats_list,
)
from agent.routes.memory import (
    memory_clear,
    memory_snapshot,
    memory_state_get,
    memory_state_post,
)
from agent.routes.models import connect_handler, model_set, models_list
from agent.routes.skills import skill_create, skill_delete, skill_get, skill_update, skills_list
from agent.routes.system import health, set_mode, shutdown_handler, status, tools_list

# Origins allowed to call the backend from a browser context. The Tauri
# shell uses `tauri://localhost` (or `http://tauri.localhost` on Windows);
# the Vite dev server lives on port 1420. Any other origin is rejected so a
# random web page cannot drive the agent via http://localhost:8765.
_ALLOWED_ORIGINS = frozenset(
    {
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    }
)


def _generate_auth_token() -> str:
    """Generate a fresh shared secret and persist it so the Tauri shell can
    read it and sign requests. The file is rewritten on every backend start,
    so a stolen token from a previous session is useless."""
    token = secrets.token_hex(32)
    try:
        _auth_token_path().write_text(token, encoding="utf-8")
    except OSError as e:
        warn(f"could not persist auth token: {e}")
    return token


def _is_dev_mode() -> bool:
    return __import__("os").environ.get("WARDEN_DEV") == "1"


@web.middleware
async def _cors_middleware(request: web.Request, handler):
    # Preflight: only answer when the origin is allowlisted. Any foreign
    # page trying to probe the API gets a 403 and no CORS headers.
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin", "")
        if origin and origin in _ALLOWED_ORIGINS:
            resp = web.Response(status=204)
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Warden-Token"
            resp.headers["Vary"] = "Origin"
            return resp
        return web.Response(status=403, text="origin not allowed")
    return await handler(request)


@web.middleware
async def _auth_middleware(request: web.Request, handler):
    # /health is the only unauthenticated endpoint — the Tauri shell and the
    # dev probe use it to wait for the backend. Everything else needs either
    # a dev-mode opt-out (WARDEN_DEV=1) or a valid X-Warden-Token header.
    if request.path == "/health":
        return await handler(request)
    if _is_dev_mode():
        return await handler(request)
    expected = request.app.get("auth_token")
    if not expected:
        return await handler(request)
    supplied = request.headers.get("X-Warden-Token", "")
    if secrets.compare_digest(supplied, expected):
        return await handler(request)
    log_request(request.method, request.path, 403)
    return web.Response(status=403, text="forbidden")


async def _cors_headers(request: web.Request, response: web.StreamResponse) -> None:
    # Echo the specific allowlisted origin back instead of `*`. Without a
    # matching Origin header we send nothing, so a cross-origin fetch from a
    # random site gets no usable CORS header and the browser blocks the
    # response.
    origin = request.headers.get("Origin", "")
    if origin and origin in _ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Warden-Token"
        response.headers["Vary"] = "Origin"


async def main() -> Backend:
    info("starting backend...")
    backend = Backend()
    await backend.setup()
    auth_token = _generate_auth_token()
    if _is_dev_mode():
        info("auth: dev mode (WARDEN_DEV=1) — token not required")
    else:
        success(f"auth token written to {_auth_token_path()}")
    success("remote API ready")

    shutdown_event = asyncio.Event()
    app = web.Application(middlewares=[_cors_middleware, _auth_middleware])
    app.on_response_prepare.append(_cors_headers)
    app["backend"] = backend
    app["auth_token"] = auth_token
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


# backward-compat shims so existing tests still resolve these names via server
from agent.app_state import get_backend as _get_backend  # noqa: E402
from agent.routes.chat import (  # noqa: E402
    _FILE_ID_RE,
    _SAFE_FILENAME_RE,
    _client_disconnected,
    _fallback_title,
)


if __name__ == "__main__":
    backend = None
    try:
        backend = asyncio.run(main())
    except KeyboardInterrupt:
        pass
