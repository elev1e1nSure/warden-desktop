import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, BookPlus, ChevronDown, Layers, Loader2, Minus, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useThrottledValue } from "../hooks/useThrottledValue";
import { mdComponents } from "./markdown";
import { blockEnter, collapse, EASE, labelFade } from "../motion";
import type { Block } from "../types";

// ─── types ──────────────────────────────────────────────────────────────────

type ToolBlock = Extract<Block, { kind: "tool" }>;

type Group =
  | { kind: "single"; block: Block }
  | { kind: "tools"; items: ToolBlock[] }
  | { kind: "memory"; block: ToolBlock };

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (!b) break;
    if (b.kind === "tool") {
      if (b.name === "memory") {
        out.push({ kind: "memory", block: b });
        i++;
      } else {
        const run: ToolBlock[] = [];
        while (i < blocks.length) {
          const next = blocks[i];
          if (next?.kind !== "tool" || next.name === "memory") break;
          run.push(next);
          i++;
        }
        if (run.length > 0) out.push({ kind: "tools", items: run });
      }
    } else {
      out.push({ kind: "single", block: b });
      i++;
    }
  }
  return out;
}

const cut = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max)}…` : s);

function toolDescription(b: ToolBlock): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(b.args);
  } catch {
    // use empty args
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

    case "glob":
      return `Found files: ${cut(str("pattern"), 46)}`;

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

function groupKey(g: Group): string {
  if (g.kind === "tools") return g.items[0]?.id ?? "";
  return g.block.id;
}

// ─── blocks ──────────────────────────────────────────────────────────────────

const UserBlock = memo(function UserBlock({ text }: { text: string }) {
  return (
    <motion.div className="flex justify-end pt-3 pb-1">
      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-fill-active px-4 py-3 text-body leading-relaxed text-text-primary">
        {text}
      </div>
    </motion.div>
  );
});

const ImageBlock = memo(
  function ImageBlock({
    url,
    name,
    onExpand,
  }: {
    url: string;
    name: string;
    onExpand: () => void;
  }) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onExpand}
          className="group relative max-w-[78%] overflow-hidden rounded-2xl rounded-br-md ring-1 ring-hairline"
        >
          <img src={url} alt={name} className="max-h-80 w-auto object-contain" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <span className="rounded-lg bg-black/50 px-3 py-1.5 text-meta font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              View
            </span>
          </div>
        </button>
      </div>
    );
  },
  (prev, next) => prev.url === next.url && prev.name === next.name,
);

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <img
        src={url}
        alt={name}
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter") onClose();
        }}
      />
    </motion.div>
  );
}

const AssistantBlock = memo(function AssistantBlock({
  text,
  live = false,
}: {
  text: string;
  live?: boolean;
}) {
  // While streaming we throttle re-renders and skip the (expensive) syntax
  // highlighter — code snaps to highlighted once the block settles. This keeps
  // long answers smooth instead of re-parsing the whole message every token.
  const display = useThrottledValue(text, 40, live);
  const rendered = useMemo(
    () => (
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={live ? [] : [rehypeHighlight]}
        components={mdComponents}
      >
        {display}
      </Markdown>
    ),
    [display, live],
  );

  // `is-streaming` appends a soft blinking caret after the last rendered element
  // (see index.css) so the answer reads as actively being written.
  const streamingCaret = live && display.length > 0;

  return (
    <div
      className={`markdown-body text-body text-text-primary${streamingCaret ? " is-streaming" : ""}`}
    >
      {display.length === 0 ? (
        <span className="inline-block h-[15px] w-[6px] animate-pulse rounded-sm bg-fill-strong align-middle" />
      ) : (
        rendered
      )}
    </div>
  );
});

/* A single reasoning block. It IS the live indicator: while `live`, it shows an
   animated "Thinking…" label; once the agent moves on it settles, in place, into
   a collapsible "Thought". The element keeps a stable key for its whole life, so
   the label simply crossfades — no remount, no jump. A settled block with no
   captured reasoning renders nothing. */
const ThinkBlock = memo(function ThinkBlock({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const hasContent = text.trim().length > 0;

  // Settled, nothing was reasoned out loud — leave no trace.
  if (!live && !hasContent) return null;

  const expandable = !live && hasContent;

  return (
    <div className="-ml-5 py-0.5">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        className="group flex items-center gap-1.5 p-0 text-ui-lg text-text-secondary transition-colors hover:text-text-primary disabled:cursor-default disabled:hover:text-text-secondary"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {expandable && (
            <motion.span
              initial={{ opacity: 0, rotate: open ? 0 : -90 }}
              animate={{ opacity: 1, rotate: open ? 0 : -90 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex"
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            </motion.span>
          )}
        </span>

        <span className="relative inline-flex h-[18px] min-w-[72px] items-center">
          <AnimatePresence initial={false}>
            {live ? (
              <motion.span
                key="thinking"
                {...labelFade}
                className="shimmer-text absolute inset-0 flex items-center whitespace-nowrap font-medium"
              >
                Thinking
                <span className="ml-0.5 inline-flex">
                  <span className="thinking-dot" style={{ animationDelay: "0ms" }}>
                    .
                  </span>
                  <span className="thinking-dot" style={{ animationDelay: "140ms" }}>
                    .
                  </span>
                  <span className="thinking-dot" style={{ animationDelay: "280ms" }}>
                    .
                  </span>
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="thought"
                {...labelFade}
                className="absolute inset-0 flex items-center"
              >
                Thought
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div {...collapse} className="overflow-hidden">
            <div className="mt-2 text-ui leading-[1.7] text-text-muted">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  ...mdComponents,
                  p: (props) => <p {...props} className="my-1.5 leading-[1.7]" />,
                  a: (props) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[#7ab2ff] underline decoration-[#7ab2ff]/40 underline-offset-2"
                    />
                  ),
                }}
              >
                {text}
              </Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── memory row ─────────────────────────────────────────────────────────────

type MemoryAction = "set" | "get" | "delete" | "list" | "clear";

const MEMORY_META: Record<
  MemoryAction,
  { icon: React.ReactNode; running: string; done: (key?: string) => string }
> = {
  set: {
    icon: <BookPlus className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Remembering…",
    done: (key) => (key ? `Remembered "${cut(key, 36)}"` : "Saved to memory"),
  },
  get: {
    icon: <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Reading memory…",
    done: (key) => (key ? `Read "${cut(key, 36)}"` : "Read memory"),
  },
  delete: {
    icon: <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Forgetting…",
    done: (key) => (key ? `Forgot "${cut(key, 36)}"` : "Removed from memory"),
  },
  list: {
    icon: <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Reading memory…",
    done: () => "Listed memory",
  },
  clear: {
    icon: <X className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Clearing memory…",
    done: () => "Cleared memory",
  },
};

const MemoryRow = memo(function MemoryRow({ block }: { block: ToolBlock }) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(block.args);
  } catch {}
  const action = String(args.action ?? "")
    .trim()
    .toLowerCase() as MemoryAction;
  const key = String(args.key ?? "").trim();
  const running = block.status === "running";

  const meta = MEMORY_META[action] ?? {
    icon: <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />,
    running: "Memory…",
    done: () => "Memory operation",
  };

  const minWidth = running ? "min-w-[128px]" : "min-w-[96px]";

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1.5 text-ui-lg text-text-muted">
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-text-faint">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : meta.icon}
        </span>

        <span className={`relative inline-flex h-[18px] ${minWidth} items-center`}>
          <AnimatePresence initial={false}>
            {running ? (
              <motion.span
                key="running"
                {...labelFade}
                className="shimmer-text absolute inset-0 flex items-center whitespace-nowrap font-medium"
              >
                {meta.running}
              </motion.span>
            ) : (
              <motion.span
                key="done"
                {...labelFade}
                className="absolute inset-0 flex items-center whitespace-nowrap"
              >
                {meta.done(key || undefined)}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
});

const ToolGroup = memo(
  function ToolGroup({ items }: { items: ToolBlock[] }) {
    const [open, setOpen] = useState(false);
    const running = items.some((t) => t.status === "running");
    const n = items.length;

    const label = `Ran ${n} command${n === 1 ? "" : "s"}`;

    return (
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => !running && setOpen((v) => !v)}
          disabled={running}
          className="group flex items-center gap-1.5 p-0 text-ui-lg text-text-muted transition-colors hover:text-text-secondary disabled:cursor-default disabled:hover:text-text-muted"
        >
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <motion.span
                initial={false}
                animate={{ rotate: open ? 0 : -90 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex"
              >
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              </motion.span>
            )}
          </span>

          <span className="relative inline-flex h-[18px] min-w-[112px] items-center">
            <AnimatePresence initial={false}>
              {running ? (
                <motion.span
                  key="running"
                  {...labelFade}
                  className="shimmer-text absolute inset-0 flex items-center whitespace-nowrap font-medium"
                >
                  Running…
                </motion.span>
              ) : (
                <motion.span
                  key="ran"
                  {...labelFade}
                  className="absolute inset-0 flex items-center whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && !running && (
            <motion.div {...collapse} className="overflow-hidden">
              <ul className="mt-1 flex flex-col gap-0.5">
                {items.map((t) => (
                  <li key={t.id} className="text-ui leading-[1.65] text-text-muted">
                    {toolDescription(t)}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
  (prev, next) => {
    if (prev.items.length !== next.items.length) return false;
    return prev.items.every((item, i) => {
      const nextItem = next.items[i];
      return (
        nextItem &&
        item.id === nextItem.id &&
        item.status === nextItem.status &&
        item.result === nextItem.result &&
        item.diff === nextItem.diff &&
        item.args === nextItem.args
      );
    });
  },
);

// ─── main ────────────────────────────────────────────────────────────────────

function Timeline({
  blocks,
  generation = 0,
  streaming = false,
}: {
  blocks: Block[];
  generation?: number;
  streaming?: boolean;
}) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  // The block currently being streamed into is the last one. A think/assistant
  // block is "live" only while it is that last block and the turn is streaming;
  // once anything follows it, it settles. This single derived fact drives both
  // the Thinking→Thought morph and the assistant streaming render — no synthetic
  // slots, no block rewriting.
  const liveId = streaming ? (blocks[blocks.length - 1]?.id ?? null) : null;

  return (
    <div
      style={{ transform: "translateX(var(--chat-shift, 0px))" }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="flex w-full flex-col gap-2 px-6 pt-12 pb-32">
        <AnimatePresence>
          {groups.map((g) => (
            <motion.div key={`${generation}-${groupKey(g)}`} {...blockEnter}>
              {g.kind === "single" && g.block.kind === "user" && <UserBlock text={g.block.text} />}
              {g.kind === "single" && g.block.kind === "think" && (
                <ThinkBlock text={g.block.text} live={g.block.id === liveId} />
              )}
              {g.kind === "single" &&
                g.block.kind === "image" &&
                (() => {
                  const b = g.block;
                  return (
                    <ImageBlock
                      url={b.url}
                      name={b.name}
                      onExpand={() => setLightbox({ url: b.url, name: b.name })}
                    />
                  );
                })()}
              {g.kind === "single" && g.block.kind === "assistant" && (
                <AssistantBlock text={g.block.text} live={g.block.id === liveId} />
              )}
              {g.kind === "single" && g.block.kind === "error" && (
                <p className="text-ui text-danger">{g.block.text}</p>
              )}
              {g.kind === "tools" && <ToolGroup items={g.items} />}
              {g.kind === "memory" && <MemoryRow block={g.block} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {lightbox && (
          <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(Timeline);
