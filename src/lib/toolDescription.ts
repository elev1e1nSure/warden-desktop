import type { Block } from "../types";

type ToolBlock = Extract<Block, { kind: "tool" }>;

export const cut = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max)}…` : s);

export function toolDescription(b: ToolBlock): string {
  let args: Record<string, unknown> = {};
  if (typeof b.args === "object" && b.args !== null) {
    args = b.args as Record<string, unknown>;
  } else if (typeof b.args === "string") {
    try {
      args = JSON.parse(b.args);
    } catch {
      // use empty args
    }
  }

  const str = (key: string, fallback = "") => String(args[key] ?? fallback).trim();
  const base = (p: string) => p.split(/[\\/]/).pop() || p;

  switch (b.name) {
    case "screenshot":
      return "Took a screenshot";

    case "mouse": {
      const action = str("action", "click");
      const x = args.x ?? "?";
      const y = args.y ?? "?";
      if (action === "click") return `Clicked at (${x}, ${y})`;
      if (action === "right_click") return `Right-clicked at (${x}, ${y})`;
      if (action === "double_click") return `Double-clicked at (${x}, ${y})`;
      if (action === "move") return `Moved mouse to (${x}, ${y})`;
      if (action === "scroll") return `Scrolled at (${x}, ${y})`;
      if (action === "drag") return `Dragged (${x}, ${y}) → (${args.x2 ?? "?"}, ${args.y2 ?? "?"})`;
      return `Mouse ${action} at (${x}, ${y})`;
    }

    case "keyboard": {
      const text = str("text");
      const action = str("action", "type");
      if (action === "press") {
        const key = text
          .split("+")
          .map((k) => k.trim())
          .filter(Boolean)
          .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
          .join("+");
        return `Pressed ${key || text}`;
      }
      return `Typed "${cut(text, 40)}"`;
    }

    case "clipboard": {
      const action = str("action", "read");
      if (action === "write") {
        const text = str("text");
        return text ? `Copied to clipboard: "${cut(text, 30)}"` : "Copied to clipboard";
      }
      return "Read clipboard";
    }

    case "browser_open":
      return `Opened ${cut(str("url"), 52)}`;

    case "browser_read":
      return `Read ${cut(str("url"), 52)}`;

    case "browser_screenshot":
      return str("url") ? `Screenshot of ${cut(str("url"), 44)}` : "Took browser screenshot";

    case "browser_click":
      return `Clicked "${cut(str("selector"), 40)}" in browser`;

    case "browser_fill": {
      const val = str("value");
      const sel = str("selector");
      return val ? `Typed "${cut(val, 28)}" into ${cut(sel, 28)}` : `Filled ${cut(sel, 44)}`;
    }

    case "youtube_search":
      return `Searched YouTube: "${cut(str("query"), 40)}"`;

    case "google_search":
      return `Searched Google: "${cut(str("query"), 40)}"`;

    case "web_fetch":
      return `Fetched ${cut(str("url"), 52)}`;

    case "http_request":
      return `${str("method", "GET").toUpperCase()} ${cut(str("url"), 46)}`;

    case "window_list": {
      const filter = str("filter");
      return filter ? `Listed windows: "${filter}"` : "Listed open windows";
    }

    case "window_focus": {
      const title = str("title");
      return title ? `Focused "${cut(title, 42)}"` : "Focused window";
    }

    case "window_manage": {
      const title = str("title");
      const action = str("action");
      const label = action ? `${action.charAt(0).toUpperCase()}${action.slice(1)}d` : "Managed";
      return title ? `${label} window "${cut(title, 36)}"` : `${label} window`;
    }

    case "process_list": {
      const filter = str("filter");
      return filter ? `Listed processes: "${filter}"` : "Listed processes";
    }

    case "process_kill":
      return `Killed process ${str("pid")}`;

    case "ocr":
      return "Read text from screenshot";

    case "image_locate":
      return `Located ${base(str("image"))} on screen`;

    case "wait_for": {
      const target = str("target");
      const type = str("type");
      const timeout = str("timeout");
      const typeLabel = type ? `${type} ` : "";
      const timeoutLabel = timeout ? ` (${timeout}s)` : "";
      return `Waited for ${typeLabel}"${cut(target, 32)}"${timeoutLabel}`;
    }

    case "file_read":
      return `Read ${base(str("path"))}`;

    case "file_write":
      return `Wrote ${base(str("path"))}`;

    case "file_delete":
      return `Deleted ${base(str("path"))}`;

    case "file_list":
      return `Listed ${cut(str("path", "."), 48)}`;

    case "file_move":
      return `Moved ${base(str("src"))} → ${base(str("dst"))}`;

    case "file_copy":
      return `Copied ${base(str("src"))} → ${base(str("dst"))}`;

    case "edit":
      return `Edited ${base(str("path"))}`;

    case "glob": {
      const pattern = str("pattern");
      const res = b.result ? b.result.trim() : "";
      if (res && res !== "(no matches)") {
        const files = res.split("\n").join(", ");
        return `Found files: ${cut(files, 52)}`;
      }
      return pattern ? `Found no files for "${pattern}"` : "Found no files";
    }

    case "grep": {
      const pattern = str("pattern");
      const path = str("path");
      return path
        ? `Searched "${cut(pattern, 28)}" in ${cut(path, 26)}`
        : `Searched for "${cut(pattern, 44)}"`;
    }

    case "bash":
    case "powershell": {
      const cmd = str("command")
        .replace(/\s*\n\s*/g, "; ")
        .replace(/\s+/g, " ")
        .trim();
      return `Ran \`${cut(cmd, 52)}\``;
    }

    case "apply_patch":
      return "Applied patch";

    case "archive": {
      const action = str("action");
      return action
        ? `${action.charAt(0).toUpperCase()}${action.slice(1)} archive`
        : "Archive operation";
    }

    case "system_info":
      return "Got system info";

    case "notify": {
      const msg = str("message");
      return msg ? `Notified: "${cut(msg, 40)}"` : "Sent notification";
    }

    case "memory": {
      const action = str("action");
      const key = str("key");
      const map: Record<string, string> = {
        set: key ? `Saved "${cut(key, 36)}"` : "Saved to memory",
        get: key ? `Read "${cut(key, 36)}"` : "Read all memory",
        delete: key ? `Removed "${cut(key, 36)}"` : "Removed from memory",
        list: "Listed memory",
        clear: "Cleared memory",
      };
      return map[action] ?? "Memory operation";
    }

    case "lsp": {
      const method = str("method");
      return method ? `LSP: ${cut(method, 46)}` : "LSP operation";
    }

    case "question":
      return "Asked a question";

    case "skill": {
      const name = str("name");
      return name ? `Used skill "${cut(name, 40)}"` : "Used skill";
    }

    case "todo_write":
      return "Updated task list";

    default: {
      const firstVal = Object.values(args)[0];
      const val = firstVal ? cut(String(firstVal).replace(/\s+/g, " "), 44) : "";
      const name = b.name.replace(/_/g, " ");
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return val ? `${label}: ${val}` : label;
    }
  }
}

export function toolRunningLabel(b: ToolBlock): string {
  let args: Record<string, unknown> = {};
  if (typeof b.args === "object" && b.args !== null) {
    args = b.args as Record<string, unknown>;
  } else if (typeof b.args === "string") {
    try {
      args = JSON.parse(b.args);
    } catch {
      // use empty args
    }
  }

  const str = (key: string, fallback = "") => String(args[key] ?? fallback).trim();

  switch (b.name) {
    case "screenshot":
      return "Taking screenshot…";

    case "mouse": {
      const action = str("action", "click");
      if (action === "move") return "Moving mouse…";
      if (action === "scroll") return "Scrolling…";
      if (action === "drag") return "Dragging…";
      return "Clicking…";
    }

    case "keyboard": {
      const action = str("action", "type");
      if (action === "press") return "Pressing keys…";
      return "Typing…";
    }

    case "clipboard": {
      const action = str("action", "read");
      if (action === "write") return "Copying to clipboard…";
      return "Reading clipboard…";
    }

    case "browser_open":
      return "Opening browser…";

    case "browser_read":
      return "Reading web page…";

    case "browser_screenshot":
      return "Taking browser screenshot…";

    case "browser_click":
      return "Clicking element…";

    case "browser_fill":
      return "Filling form…";

    case "youtube_search": {
      const query = str("query");
      return query ? `Searching YouTube for "${cut(query, 32)}"…` : "Searching YouTube…";
    }

    case "google_search": {
      const query = str("query");
      return query ? `Searching Google for "${cut(query, 32)}"…` : "Searching Google…";
    }

    case "web_fetch":
      return "Fetching URL…";

    case "http_request":
      return "Sending HTTP request…";

    case "window_list":
      return "Listing windows…";

    case "window_focus":
      return "Focusing window…";

    case "window_manage":
      return "Managing window…";

    case "process_list":
      return "Listing processes…";

    case "process_kill":
      return "Killing process…";

    case "ocr":
      return "Reading text from screen…";

    case "image_locate":
      return "Locating image…";

    case "wait_for":
      return "Waiting…";

    case "file_read":
      return "Reading file…";

    case "file_write":
      return "Writing file…";

    case "file_delete":
      return "Deleting file…";

    case "file_list":
      return "Listing directory…";

    case "file_move":
      return "Moving file…";

    case "file_copy":
      return "Copying file…";

    case "edit":
      return "Editing file…";

    case "glob": {
      const pattern = str("pattern");
      return pattern ? `Finding files matching "${cut(pattern, 32)}"…` : "Finding files…";
    }

    case "grep": {
      const pattern = str("pattern");
      return pattern ? `Searching for "${cut(pattern, 32)}"…` : "Searching files…";
    }

    case "bash":
    case "powershell":
      return "Running command…";

    case "apply_patch":
      return "Applying patch…";

    case "archive":
      return "Archiving…";

    case "system_info":
      return "Getting system info…";

    case "notify":
      return "Sending notification…";

    case "memory": {
      const action = str("action");
      if (action === "set") return "Remembering…";
      if (action === "get" || action === "list") return "Reading memory…";
      if (action === "delete") return "Forgetting…";
      if (action === "clear") return "Clearing memory…";
      return "Using memory…";
    }

    case "lsp":
      return "Running LSP…";

    case "question":
      return "Asking a question…";

    case "skill":
      return "Using skill…";

    case "todowrite":
    case "todo_write":
      return "Updating task list…";

    default: {
      const name = b.name.replace(/[_-]/g, " ").trim();
      if (name) {
        return `${name.charAt(0).toUpperCase()}${name.slice(1)}…`;
      }
      return "Running…";
    }
  }
}
