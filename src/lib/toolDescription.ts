import type { Block } from "../types";

type ToolBlock = Extract<Block, { kind: "tool" }>;

export const cut = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max)}…` : s);

export interface ToolLabel {
  verb: string;
  arg?: string;
}

export function toolDescription(b: ToolBlock): ToolLabel {
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
  const r = (verb: string, arg?: string): ToolLabel => ({ verb, arg });

  switch (b.name) {
    case "screenshot":
      return r("Took screenshot");

    case "mouse": {
      const action = str("action", "click");
      const x = args.x ?? "?";
      const y = args.y ?? "?";
      if (action === "click") return r("Clicked", `(${x}, ${y})`);
      if (action === "right_click") return r("Right-clicked", `(${x}, ${y})`);
      if (action === "double_click") return r("Double-clicked", `(${x}, ${y})`);
      if (action === "move") return r("Moved mouse to", `(${x}, ${y})`);
      if (action === "scroll") return r("Scrolled", `(${x}, ${y})`);
      if (action === "drag")
        return r("Dragged", `(${x}, ${y}) → (${args.x2 ?? "?"}, ${args.y2 ?? "?"})`);
      return r(`Mouse ${action}`, `(${x}, ${y})`);
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
        return r("Pressed", key || text);
      }
      return r("Typed", cut(text, 40));
    }

    case "clipboard": {
      const action = str("action", "read");
      if (action === "write") {
        const text = str("text");
        return text ? r("Copied to clipboard", cut(text, 30)) : r("Copied to clipboard");
      }
      return r("Read clipboard");
    }

    case "browser_open":
      return r("Opened", cut(str("url"), 52));

    case "browser_read":
      return r("Read", cut(str("url"), 52));

    case "browser_screenshot":
      return str("url") ? r("Screenshot of", cut(str("url"), 44)) : r("Took browser screenshot");

    case "browser_click":
      return r("Clicked", cut(str("selector"), 40));

    case "browser_fill": {
      const val = str("value");
      const sel = str("selector");
      return val ? r("Typed", `${cut(val, 28)} into ${cut(sel, 28)}`) : r("Filled", cut(sel, 44));
    }

    case "youtube_search":
      return r("Searched YouTube", cut(str("query"), 40));

    case "google_search":
      return r("Searched Google", cut(str("query"), 40));

    case "webfetch":
    case "web_fetch":
      return r("Fetched", cut(str("url"), 52));

    case "http_request":
      return r(str("method", "GET").toUpperCase(), cut(str("url"), 46));

    case "window_list": {
      const filter = str("filter");
      return filter ? r("Listed windows", filter) : r("Listed windows");
    }

    case "window_focus": {
      const title = str("title");
      return title ? r("Focused", cut(title, 42)) : r("Focused window");
    }

    case "window_manage": {
      const title = str("title");
      const action = str("action");
      const verb = action
        ? `${action.charAt(0).toUpperCase()}${action.slice(1)}d window`
        : "Managed window";
      return title ? r(verb, cut(title, 36)) : r(verb);
    }

    case "process_list": {
      const filter = str("filter");
      return filter ? r("Listed processes", filter) : r("Listed processes");
    }

    case "process_kill":
      return r("Killed process", str("pid"));

    case "ocr":
      return r("Read text from screenshot");

    case "image_locate":
      return r("Located", base(str("image")));

    case "wait_for": {
      const target = str("target");
      const type = str("type");
      const timeout = str("timeout");
      const typeLabel = type ? `${type} ` : "";
      const timeoutLabel = timeout ? ` (${timeout}s)` : "";
      return r("Waited for", `${typeLabel}${cut(target, 32)}${timeoutLabel}`);
    }

    case "file_read":
      return r("Read", base(str("path")));

    case "file_write":
      return r("Wrote", base(str("path")));

    case "file_delete":
      return r("Deleted", base(str("path")));

    case "file_list":
      return r("Listed", cut(str("path", "."), 48));

    case "file_move":
      return r("Moved", `${base(str("src"))} → ${base(str("dst"))}`);

    case "file_copy":
      return r("Copied", `${base(str("src"))} → ${base(str("dst"))}`);

    case "edit":
      return r("Edited", base(str("path")));

    case "glob": {
      const pattern = str("pattern");
      const res = b.result ? b.result.trim() : "";
      if (res && res !== "(no matches)") {
        const files = res.split("\n").join(", ");
        return r("Found files", cut(files, 52));
      }
      return r("Found no files", pattern || undefined);
    }

    case "grep": {
      const pattern = str("pattern");
      const path = str("path");
      return path
        ? r("Searched", `${cut(pattern, 28)} in ${cut(path, 26)}`)
        : r("Searched", cut(pattern, 44));
    }

    case "bash":
    case "powershell": {
      const cmd = str("command")
        .replace(/\s*\n\s*/g, "; ")
        .replace(/\s+/g, " ")
        .trim();
      return r("Ran", cut(cmd, 52));
    }

    case "apply_patch":
      return r("Applied patch");

    case "archive": {
      const action = str("action");
      return action
        ? r(`${action.charAt(0).toUpperCase()}${action.slice(1)}d archive`)
        : r("Archive operation");
    }

    case "system_info":
      return r("Got system info");

    case "notify": {
      const msg = str("message");
      return msg ? r("Notified", cut(msg, 40)) : r("Sent notification");
    }

    case "memory": {
      const action = str("action");
      const key = str("key");
      const map: Record<string, ToolLabel> = {
        set: key ? r("Saved to memory", cut(key, 36)) : r("Saved to memory"),
        get: key ? r("Read from memory", cut(key, 36)) : r("Read all memory"),
        delete: key ? r("Removed from memory", cut(key, 36)) : r("Removed from memory"),
        list: r("Listed memory"),
        clear: r("Cleared memory"),
      };
      return map[action] ?? r("Memory operation");
    }

    case "lsp": {
      const method = str("method");
      return method ? r("LSP", cut(method, 46)) : r("LSP operation");
    }

    case "question":
      return r("Asked a question");

    case "skill": {
      const name = str("name");
      return name ? r("Used skill", cut(name, 40)) : r("Used skill");
    }

    case "todowrite":
    case "todo_write":
      return r("Updated task list");

    default: {
      const firstVal = Object.values(args)[0];
      const val = firstVal ? cut(String(firstVal).replace(/\s+/g, " "), 44) : undefined;
      const name = b.name.replace(/_/g, " ");
      const verb = name.charAt(0).toUpperCase() + name.slice(1);
      return r(verb, val);
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

    case "webfetch":
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
