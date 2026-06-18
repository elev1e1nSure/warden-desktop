from __future__ import annotations

import asyncio

from aiohttp import web

from agent.app_state import get_backend
from agent.llm_client import OpenAIClient
from agent.logger import info, warn
from agent.logger import request as log_request


async def models_list(request: web.Request) -> web.Response:
    backend = get_backend(request)
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
    backend = get_backend(request)
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
    backend = get_backend(request)
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
