"""Tool-level safety assessment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agent.safety._filesystem import is_dangerous_path, is_path_within_workspace
from agent.safety._powershell import classify as classify_powershell

# Maps each tool name to a permission group.
TOOL_GROUP: dict[str, str] = {
    "bash": "shell",
    "powershell": "shell",
    "file_read": "files",
    "read": "files",
    "file_write": "files",
    "write": "files",
    "file_delete": "files",
    "delete": "files",
    "file_list": "files",
    "list": "files",
    "glob": "files",
    "grep": "files",
    "edit": "files",
    "file_move": "files",
    "file_copy": "files",
    "apply_patch": "files",
    "archive": "files",
    "lsp": "files",
    "google_search": "search",
    "youtube_search": "search",
    "browser_open": "search",
    "browser_read": "search",
    "browser_screenshot": "search",
    "webfetch": "search",
    "http_request": "search",
    "browser_click": "search",
    "browser_fill": "search",
    "mouse": "pc_control",
    "keyboard": "pc_control",
    "screenshot": "pc_control",
    "clipboard": "pc_control",
    "window_list": "pc_control",
    "window_focus": "pc_control",
    "window_manage": "pc_control",
    "image_locate": "pc_control",
    "ocr": "pc_control",
    "wait_for": "pc_control",
    "process_list": "processes",
    "process_kill": "processes",
    "system_info": "system",
    "notify": "system",
}

# Canonical group order for the UI.
PERMISSION_GROUPS = ["files", "shell", "search", "pc_control", "processes", "system"]


@dataclass
class SafetyDecision:
    risk: str  # "safe" | "confirm" | "blocked"
    reason: str
    summary: str
    details: list[str] = field(default_factory=list)
    normalized_args: dict[str, Any] = field(default_factory=dict)


def _decide(
    risk, reason, summary, details=None, args=None, tool=None, mode="ask"
) -> SafetyDecision:
    d = SafetyDecision(
        risk=risk, reason=reason, summary=summary, details=details or [], normalized_args=args or {}
    )
    return _apply_mode(d, tool or "", mode)


def _apply_mode(decision: SafetyDecision, tool_name: str, mode: str) -> SafetyDecision:
    # In auto mode, `confirm` is normally promoted to `safe` so the agent can
    # run without prompting on every step. A few operations stay gated even in
    # auto mode because they can escape the workspace or are destructive:
    #   - file_delete / delete                 — always destructive
    #   - file_write / edit / apply_patch       — when the target path is
    #                                              outside the workspace (the
    #                                              decision reason carries the
    #                                              "outside workspace" marker)
    #   - file_read / file_list                 — outside workspace reads stay
    #                                              gated so secrets (.env,
    #                                              ~/.ssh, browser cookies) are
    #                                              not silently exfiltrated
    if mode == "auto" and decision.risk == "confirm":
        # apply_patch can target arbitrary paths inside the patch text that
        # the safety layer cannot inspect ahead of time, so it always stays
        # gated in auto mode.
        always_gated = tool_name in ("file_delete", "delete", "apply_patch")
        outside_workspace = "outside workspace" in decision.reason
        if not always_gated and not outside_workspace:
            return SafetyDecision(
                risk="safe",
                reason=decision.reason,
                summary=decision.summary,
                details=decision.details,
                normalized_args=decision.normalized_args,
            )
    return decision


def assess_tool_call(
    tool_name: str,
    args: dict,
    cwd: str | None = None,
    mode: str = "ask",
    permissions: dict[str, str] | None = None,
) -> SafetyDecision:
    if cwd is None:
        cwd = os.getcwd()
    workspace = Path(cwd).resolve()
    norm = dict(args)

    # Apply per-group permission overrides before the policy runs.
    if permissions:
        group = TOOL_GROUP.get(tool_name)
        if group:
            perm = permissions.get(group)
            if perm == "block":
                return SafetyDecision(
                    risk="blocked",
                    reason="disabled in permission settings",
                    summary="Blocked in settings",
                    normalized_args=norm,
                )
            elif perm == "allow":
                mode = "auto"
            elif perm == "ask":
                mode = "ask"

    def _d(risk, reason, summary, details=None):
        return _decide(risk, reason, summary, details, norm, tool_name, mode)

    # file_write
    if tool_name in ("file_write", "write"):
        path = str(norm.get("path", ""))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "File path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "writes outside workspace", "Writing file outside workspace")
        return _d("confirm", "modifies files", "Writing file inside workspace")

    # file_delete
    if tool_name in ("file_delete", "delete"):
        path = str(norm.get("path", ""))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "File path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d(
                "blocked", "deletes outside workspace", "Deleting file outside workspace is blocked"
            )
        return _d("confirm", "destructive file operation", "Deleting file inside workspace")

    # file_read
    if tool_name in ("file_read", "read"):
        path = str(norm.get("path", ""))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "File path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "reads outside workspace", "Reading file outside workspace")
        return _d("safe", "read-only", "Reading file")

    # edit (in-place string replacement in a file)
    if tool_name == "edit":
        path = str(norm.get("path", ""))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "File path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "writes outside workspace", "Editing file outside workspace")
        return _d("confirm", "modifies files", "Editing file inside workspace")

    # glob (file discovery by pattern)
    if tool_name == "glob":
        path = str(norm.get("path") or ".")
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "Path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "lists outside workspace", "Globbing outside workspace")
        return _d("safe", "read-only", "Globbing inside workspace")

    # grep (content search)
    if tool_name == "grep":
        path = str(norm.get("path") or ".")
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "Path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "reads outside workspace", "Searching outside workspace")
        return _d("safe", "read-only", "Searching inside workspace")

    # lsp (language server queries — read-only by design)
    if tool_name == "lsp":
        path = str(norm.get("path") or norm.get("root") or ".")
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "Path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "reads outside workspace", "LSP query outside workspace")
        return _d("safe", "read-only", "LSP query inside workspace")

    # file_list
    if tool_name in ("file_list", "list"):
        path = str(norm.get("path", "."))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "Path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(path, workspace):
            return _d("confirm", "lists outside workspace", "Listing directory outside workspace")
        return _d("safe", "read-only", "Listing directory")

    # todowrite / skill
    if tool_name == "todowrite":
        return _d("safe", "updates session todo state", "Updating todo list")
    if tool_name == "skill":
        return _d(
            "safe", "reads local skill files", "Loading skill", [f"name: {norm.get('name', '')}"]
        )

    # bash / powershell
    if tool_name in ("bash", "powershell"):
        command = str(norm.get("command", ""))
        risk, reason, details = classify_powershell(command)
        summary = "Read-only shell command" if risk == "safe" else reason.capitalize()
        return _d(risk, reason, summary, details)

    # clipboard
    if tool_name == "clipboard":
        if str(norm.get("action", "read")).lower() == "read":
            return _d("safe", "read-only", "Reading clipboard")
        return _d("confirm", "modifies clipboard", "Writing to clipboard")

    # screenshot
    if tool_name == "screenshot":
        return _d("safe", "read-only", "Taking screenshot")

    # mouse
    if tool_name == "mouse":
        action = str(norm.get("action", "click")).lower()
        if action == "move":
            return _d("safe", "read-only pointer", "Moving cursor")
        return _d(
            "confirm", "simulates input", f"Mouse {action}", ["can interact with UI elements"]
        )

    # keyboard
    if tool_name == "keyboard":
        action = str(norm.get("action", "type")).lower()
        text = str(norm.get("text", "")).lower()
        if action == "press":
            dangerous = {"delete", "backspace", "alt+f4", "ctrl+w", "ctrl+shift+w"}
            if any(dk in text for dk in dangerous):
                return _d(
                    "confirm",
                    "destructive key combination",
                    f"Pressing {text}",
                    ["can close windows or delete content"],
                )
        return _d("confirm", "simulates input", f"Keyboard {action}", ["types or presses keys"])

    # browser_open
    if tool_name == "browser_open":
        url = str(norm.get("url", "")).lower()
        if "localhost" in url or "127.0.0.1" in url:
            return _d("safe", "local URL", "Opening localhost URL", [])
        return _d("confirm", "opens external URL", "Opening external URL", [])

    # read-only browser / search tools
    if tool_name in ("browser_read", "browser_screenshot", "youtube_search", "google_search"):
        return _d("safe", "read-only", f"Using {tool_name}")

    # apply_patch
    if tool_name == "apply_patch":
        return _d(
            "confirm",
            "modifies files via patch",
            "Applying patch to files",
            ["can create, modify, delete, or rename files"],
        )

    # webfetch
    if tool_name == "webfetch":
        url = str(norm.get("url", "")).lower()
        if "localhost" in url or "127.0.0.1" in url or "::1" in url:
            return _d("safe", "read-only local", "Fetching local URL", [f"url: {url}"])
        return _d("safe", "read-only", f"Fetching {url}")

    # question
    if tool_name == "question":
        return _d("safe", "interactive", "Asking user")

    # process_list / process_kill
    if tool_name == "process_list":
        return _d("safe", "read-only", "Listing processes")
    if tool_name == "process_kill":
        return _d(
            "confirm",
            "terminates a process",
            "Killing process",
            ["can disrupt the system or other applications"],
        )

    # file_move / file_copy
    if tool_name in ("file_move", "file_copy"):
        src = str(norm.get("src", ""))
        dest = str(norm.get("dest", ""))
        if is_dangerous_path(src) or is_dangerous_path(dest):
            return _d(
                "blocked",
                "dangerous path",
                "Path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if not is_path_within_workspace(src, workspace) or not is_path_within_workspace(
            dest, workspace
        ):
            return _d(
                "blocked",
                "path outside workspace",
                "file_move/file_copy outside workspace is blocked",
            )
        return _d("confirm", "mutates filesystem", f"{tool_name} inside workspace")

    # archive
    if tool_name == "archive":
        action = str(norm.get("action", "list")).lower()
        path = str(norm.get("path", ""))
        if is_dangerous_path(path):
            return _d(
                "blocked",
                "dangerous path",
                "Archive path is outside allowed scope",
                ["UNC path, device path, or traversal detected"],
            )
        if action == "list":
            return _d("safe", "read-only", "Listing archive")
        if action == "create":
            sources = norm.get("sources", []) or []
            if not is_path_within_workspace(path, workspace):
                return _d("blocked", "path outside workspace", "Archive path is outside workspace")
            for s in sources:
                if is_dangerous_path(str(s)) or not is_path_within_workspace(str(s), workspace):
                    return _d(
                        "blocked", "source outside workspace", "Archive source is outside workspace"
                    )
            return _d("confirm", "creates archive", "Creating archive")
        if action == "extract":
            dest = str(norm.get("dest", "")) or path
            if is_dangerous_path(dest) or not is_path_within_workspace(dest, workspace):
                return _d("blocked", "path outside workspace", "Extract dest is outside workspace")
            return _d("confirm", "extracts archive", "Extracting archive")
        return _d(
            "confirm",
            "unknown archive action",
            f"archive {action}",
            ["action must be list, extract, or create"],
        )

    # window tools
    if tool_name == "window_list":
        return _d("safe", "read-only", "Listing windows")
    if tool_name == "window_focus":
        return _d(
            "confirm",
            "changes foreground window",
            "Focusing window",
            [f"title: {norm.get('title', '')}", f"hwnd: {norm.get('hwnd', '')}"],
        )
    if tool_name == "window_manage":
        action = str(norm.get("action", "")).lower()
        return _d(
            "confirm",
            "manipulates a window",
            f"Window {action}",
            ["can move, resize, minimize, maximize, or close windows"],
        )

    # screen perception
    if tool_name == "image_locate":
        return _d("safe", "read-only", "Locating image on screen")
    if tool_name == "ocr":
        return _d("safe", "read-only", "Recognizing text on screen")
    if tool_name == "wait_for":
        return _d(
            "safe",
            "read-only polling",
            f"Waiting for {norm.get('type', '')}",
            [f"target: {norm.get('target', '')}"],
        )

    # system_info / notify
    if tool_name == "system_info":
        return _d("safe", "read-only", "Reading system info")
    if tool_name == "notify":
        return _d("safe", "shows a notification", "Sending desktop notification")

    # memory
    if tool_name == "memory":
        return _d("safe", "local notes store", f"memory {norm.get('action', '')}")

    # http_request
    if tool_name == "http_request":
        method = str(norm.get("method", "GET")).upper()
        url = str(norm.get("url", ""))
        if method in ("GET", "HEAD", "OPTIONS"):
            return _d("safe", "read-only request", f"{method} {url}")
        return _d(
            "confirm",
            "sends a write request",
            f"{method} {url}",
            ["can create or modify remote state"],
        )

    # interactive browser
    if tool_name == "browser_click":
        return _d(
            "confirm",
            "interacts with a web page",
            "Clicking page element",
            [f"selector: {norm.get('selector', '')}"],
        )
    if tool_name == "browser_fill":
        return _d(
            "confirm",
            "interacts with a web page",
            "Filling page field",
            [f"selector: {norm.get('selector', '')}"],
        )

    return _d(
        "confirm",
        "unknown tool",
        f"Unknown tool: {tool_name}",
        ["no safety policy defined — requires confirmation"],
    )
