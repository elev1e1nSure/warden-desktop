from __future__ import annotations

from aiohttp import web

from agent.logger import request as log_request


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
