import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState, memo } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { Block } from "../types";

// ─── types ──────────────────────────────────────────────────────────────────

type ToolBlock = Extract<Block, { kind: "tool" }>;

type Group = { kind: "single"; block: Block } | { kind: "tools"; items: ToolBlock[] };

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (!b) break;
    if (b.kind === "tool") {
      const run: ToolBlock[] = [];
      while (i < blocks.length) {
        const next = blocks[i];
        if (next?.kind !== "tool") break;
        run.push(next);
        i++;
      }
      out.push({ kind: "tools", items: run });
    } else {
      out.push({ kind: "single", block: b });
      i++;
    }
  }
  return out;
}

function toolDescription(b: ToolBlock): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(b.args);
  } catch {
    // use empty args
  }

  const str = (key: string, fallback = "") => String(args[key] ?? fallback).trim();
  const cut = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max)}…` : s);
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
      const cmd = str("command").replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " ").trim();
      return `Ran \`${cut(cmd, 52)}\``;
    }

    case "apply_patch":
      return "Applied patch";

    case "archive": {
      const action = str("action");
      return action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} archive` : "Archive operation";
    }

    case "system_info":
      return "Got system info";

    case "notify": {
      const msg = str("message");
      return msg ? `Notified: "${cut(msg, 40)}"` : "Sent notification";
    }

    case "memory": {
      const action = str("action");
      const map: Record<string, string> = {
        save: "Saved to memory",
        recall: "Recalled from memory",
        delete: "Deleted from memory",
        list: "Listed memories",
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
  return g.kind === "tools" ? (g.items[0]?.id ?? "") : g.block.id;
}

// ─── blocks ──────────────────────────────────────────────────────────────────

const UserBlock = memo(function UserBlock({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-fill-active px-4 py-3 text-body leading-relaxed text-text-primary">
        {text}
      </div>
    </div>
  );
});

const ImageBlock = memo(
  function ImageBlock({ url, name, onExpand }: { url: string; name: string; onExpand: () => void }) {
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
  (prev, next) => prev.url === next.url && prev.name === next.name
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

/* Shared markdown components. We map raw tags to our design tokens so
   headings/lists/tables/code blocks all match the sidebar palette. */
const mdComponents = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="my-2 leading-[1.75]" />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      {...props}
      className="mb-2 mt-4 text-[20px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="mb-2 mt-4 text-[17px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className="mb-1.5 mt-3 text-body font-semibold tracking-[-0.015em] text-text-primary"
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      {...props}
      className="mb-1.5 mt-3 text-ui-lg font-semibold tracking-[-0.01em] text-text-primary"
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="my-2 list-disc space-y-1 pl-6 marker:text-text-muted" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="my-2 list-decimal space-y-1 pl-6 marker:text-text-muted" />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li {...props} className="leading-[1.7]" />,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[#7ab2ff] underline decoration-[#7ab2ff]/40 underline-offset-2 hover:decoration-[#7ab2ff]"
    />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="my-2 border-l-2 border-line pl-3 italic text-text-secondary"
    />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="my-3 border-line" />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-hairline">
      <table {...props} className="w-full text-left text-ui" />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="bg-fill-subtle" />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) => (
    <th
      {...props}
      className="border-b border-hairline px-3 py-1.5 font-medium text-text-secondary"
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableDataCellElement>) => (
    <td
      {...props}
      className="border-b border-hairline px-3 py-1.5 text-text-primary last:border-b-0"
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const { className, children, inline, ...rest } = props;
    if (inline) {
      return (
        <code
          {...rest}
          className="rounded bg-code-bg px-[5px] py-[1px] font-mono text-meta text-code-text"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...rest} className={`${className ?? ""} font-mono text-ui`}>
        {children}
      </code>
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-3 overflow-x-auto rounded-xl bg-fill-subtle p-4 text-ui leading-[1.55] text-code-text ring-1 ring-hairline"
    />
  ),
  del: (props: React.HTMLAttributes<HTMLModElement>) => (
    <del {...props} className="text-text-muted line-through" />
  ),
  input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    // GFM task-list checkbox. Render as a static styled checkbox-like dot
    // so streamed messages don't try to re-render stateful inputs.
    const checked = props.checked;
    return (
      <span
        className={`mr-1.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
          checked ? "border-[#7ab2ff] bg-[#7ab2ff]/20" : "border-white/20 bg-transparent"
        }`}
      >
        {checked && (
          <svg
            viewBox="0 0 8 8"
            className="h-2.5 w-2.5 text-[#7ab2ff]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-label="Checked"
          >
            <path d="M1 4 L3 6 L7 1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    );
  },
};

const AssistantBlock = memo(function AssistantBlock({ text }: { text: string }) {
  // Memoising the markdown render isn't free, but for a chat block it's
  // negligible and lets streaming chunks reuse the same virtual DOM when
  // the text hasn't crossed a markdown boundary.
  const rendered = useMemo(
    () => (
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={mdComponents}
      >
        {text}
      </Markdown>
    ),
    [text],
  );

  return (
    <div className="markdown-body text-body text-text-primary">
      {text.length === 0 ? (
        <span className="inline-block h-[14px] w-[5px] animate-pulse rounded-sm bg-fill-strong align-middle" />
      ) : (
        rendered
      )}
    </div>
  );
});

const ThinkBlock = memo(function ThinkBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 p-0 text-ui-lg text-text-muted transition-colors hover:text-text-secondary"
      >
        <motion.span
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          className="flex shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        </motion.span>
        Thought
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-4 text-ui leading-[1.7] text-text-muted">
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

const ToolGroup = memo(
  function ToolGroup({ items }: { items: ToolBlock[] }) {
    const [open, setOpen] = useState(false);
    const running = items.some((t) => t.status === "running");
    const n = items.length;

    return (
      <div>
        <button
          type="button"
          onClick={() => !running && setOpen((v) => !v)}
          disabled={running}
          className="flex items-center gap-1 p-0 text-ui-lg text-text-muted transition-colors hover:text-text-secondary disabled:cursor-default disabled:hover:text-text-muted"
        >
          <span className="flex shrink-0">
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <motion.span
                initial={false}
                animate={{ rotate: open ? 0 : -90 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              </motion.span>
            )}
          </span>
          <span>{running ? "Running…" : `Ran ${n} command${n === 1 ? "" : "s"}`}</span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ul className="mt-1 flex flex-col gap-0.5 pl-4">
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
  }
);

function ThinkingIndicator() {
  return (
    <p className="flex items-center gap-1 text-ui-lg font-normal text-text-muted">
      <span>Thinking</span>
      <span className="inline-flex">
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
    </p>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

function Timeline({
  blocks,
  generation = 0,
  thinking = false,
}: {
  blocks: Block[];
  generation?: number;
  thinking?: boolean;
}) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  return (
    <div
      style={{ transform: "translateX(var(--chat-shift, 0px))" }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="flex w-full flex-col gap-4 px-6 pt-12 pb-32">
        {groups.map((g) => (
          <div key={`${generation}-${groupKey(g)}`}>
            {g.kind === "single" && g.block.kind === "user" && <UserBlock text={g.block.text} />}
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
              <AssistantBlock text={g.block.text} />
            )}
            {g.kind === "single" && g.block.kind === "think" && <ThinkBlock text={g.block.text} />}
            {g.kind === "single" && g.block.kind === "error" && (
              <p className="text-ui text-danger">{g.block.text}</p>
            )}
            {g.kind === "tools" && <ToolGroup items={g.items} />}
          </div>
        ))}

        <AnimatePresence>
          {thinking && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ThinkingIndicator />
            </motion.div>
          )}
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
