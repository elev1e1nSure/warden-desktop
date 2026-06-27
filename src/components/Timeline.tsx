import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import {
  AppWindow,
  Bell,
  BookOpen,
  BookPlus,
  Camera,
  ChevronDown,
  Clipboard,
  Code2,
  Cpu,
  Download,
  FilePlus,
  FileText,
  FolderOpen,
  GitMerge,
  Globe,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  ListTodo,
  Loader2,
  Minus,
  MousePointer,
  Package,
  Pencil,
  Play,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useThrottledValue } from "../hooks/useThrottledValue";
import { toolDescription, toolFamily, toolRunningLabel } from "../lib/toolDescription";
import { blockEnter, collapse, EASE, labelFade } from "../motion";
import type { Block } from "../types";
import { mdComponents } from "./markdown";

// ─── types ──────────────────────────────────────────────────────────────────

type ToolBlock = Extract<Block, { kind: "tool" }>;

type Group =
  | { kind: "single"; block: Block }
  // key = first block's id in this run so the virtual row stays stable
  // while only the displayed block (latest) changes inside it.
  | { kind: "tool"; block: ToolBlock; key: string };

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  for (const b of blocks) {
    if (b.kind === "tool") {
      const prev = out[out.length - 1];
      if (prev?.kind === "tool" && toolFamily(prev.block.name) === toolFamily(b.name)) {
        // Same family consecutive tool — update block in place, keep stable key.
        out[out.length - 1] = { kind: "tool", block: b, key: prev.key };
      } else {
        out.push({ kind: "tool", block: b, key: b.id });
      }
    } else {
      out.push({ kind: "single", block: b });
    }
  }
  return out;
}

function groupKey(g: Group): string {
  return g.kind === "tool" ? g.key : g.block.id;
}

/* Returns false on first render, then true once the browser is idle — but only
   while `enabled`. Used to push expensive work (syntax highlighting) past the
   initial paint: when switching chats every settled block mounts at once, and
   highlighting them all synchronously is what froze the swap on long chats. */
function useIdleFlag(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    const hasIdle = typeof window.requestIdleCallback === "function";
    const id = hasIdle
      ? window.requestIdleCallback(() => setReady(true))
      : window.setTimeout(() => setReady(true), 1);
    return () => {
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [enabled]);
  return enabled && ready;
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
  // Highlighting is the single heaviest part of a settled answer. On a chat
  // switch every block mounts at once, so doing it synchronously stalls the
  // swap on long chats. Paint plain markdown first, then upgrade to highlighted
  // once the browser is idle — code colours in a beat later, switch stays snappy.
  const highlight = useIdleFlag(!live);
  const rendered = useMemo(
    () => (
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={highlight ? [rehypeHighlight] : []}
        components={mdComponents}
      >
        {display}
      </Markdown>
    ),
    [display, highlight],
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
        className="group flex items-center gap-1.5 p-0 text-ui-lg text-text-muted font-medium transition-colors hover:text-text-secondary disabled:cursor-default disabled:hover:text-text-muted"
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
                className="absolute inset-0 flex items-center whitespace-nowrap font-medium"
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
            <div className="mt-2 pl-5 text-ui leading-[1.7] text-text-muted">
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

// ─── tool row ───────────────────────────────────────────────────────────────

function getToolIcon(toolName: string, argsStr: string) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsStr);
  } catch {}

  const str = (key: string, fallback = "") => String(args[key] ?? fallback).trim();

  const icon = (I: React.ElementType) => <I className="h-3.5 w-3.5" strokeWidth={1.75} />;

  switch (toolName) {
    // ── shell ──────────────────────────────────────────────────────────────
    case "bash":
    case "powershell":
      return icon(Play);

    // ── search ─────────────────────────────────────────────────────────────
    case "google_search":
    case "youtube_search":
    case "grep":
    case "glob":
      return icon(Search);

    // ── web / network ──────────────────────────────────────────────────────
    case "browser_open":
    case "browser_read":
    case "browser_click":
    case "browser_fill":
    case "browser_screenshot":
      return icon(Globe);

    case "webfetch":
    case "web_fetch":
      return icon(Download);

    case "http_request":
      return icon(Send);

    // ── files ──────────────────────────────────────────────────────────────
    case "file_read":
    case "file_move":
    case "file_copy":
      return icon(FileText);

    case "file_write":
      return icon(FilePlus);

    case "file_delete":
      return icon(Trash2);

    case "file_list":
      return icon(FolderOpen);

    case "edit":
      return icon(Pencil);

    case "apply_patch":
      return icon(GitMerge);

    case "archive":
      return icon(Package);

    // ── screen / input ──────────────────────────────────────────────────────
    case "screenshot":
    case "ocr":
    case "image_locate":
      return icon(Camera);

    case "mouse":
      return icon(MousePointer);

    case "keyboard":
      return icon(Keyboard);

    case "clipboard":
      return icon(Clipboard);

    // ── os / system ─────────────────────────────────────────────────────────
    case "window_list":
    case "window_focus":
    case "window_manage":
      return icon(AppWindow);

    case "process_list":
    case "process_kill":
      return icon(Cpu);

    case "system_info":
      return icon(Info);

    case "lsp":
      return icon(Code2);

    // ── agent tools ─────────────────────────────────────────────────────────
    case "todowrite":
    case "todo_write":
      return icon(ListTodo);

    case "question":
      return icon(HelpCircle);

    case "notify":
      return icon(Bell);

    case "skill":
      return icon(Sparkles);

    case "memory": {
      const action = str("action").toLowerCase();
      if (action === "set") return icon(BookPlus);
      if (action === "delete") return icon(Minus);
      if (action === "clear") return icon(X);
      if (action === "list") return icon(Layers);
      return icon(BookOpen);
    }

    default:
      return icon(Settings);
  }
}

const ToolRow = memo(
  function ToolRow({ block }: { block: ToolBlock }) {
    const running = block.status === "running";
    const runningLabel = toolRunningLabel(block);
    const doneLabel = toolDescription(block);
    const icon = getToolIcon(block.name, block.args);

    return (
      <div className="-ml-5 py-0.5">
        <div className="flex items-center gap-1.5 text-ui-lg text-text-muted font-medium">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          </span>

          <span className="relative inline-flex h-[18px] min-w-[120px] items-center">
            <AnimatePresence initial={false}>
              {running ? (
                <motion.span
                  key="running"
                  {...labelFade}
                  className="absolute inset-0 flex items-center whitespace-nowrap font-medium"
                >
                  {runningLabel}
                </motion.span>
              ) : (
                <motion.span
                  key="done"
                  {...labelFade}
                  className="absolute inset-0 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>{doneLabel.verb}</span>
                  {doneLabel.arg && (
                    <span className="font-normal text-text-faint">{doneLabel.arg}</span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.block.id === next.block.id &&
    prev.block.status === next.block.status &&
    prev.block.result === next.block.result &&
    prev.block.args === next.block.args,
);

// ─── main ────────────────────────────────────────────────────────────────────

function Timeline({
  blocks,
  generation: _generation = 0,
  streaming = false,
  scrollEl,
}: {
  blocks: Block[];
  generation?: number;
  streaming?: boolean;
  scrollEl: HTMLDivElement | null;
}) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const liveId = streaming ? (blocks[blocks.length - 1]?.id ?? null) : null;

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 100,
    overscan: 5,
    getItemKey: (index: number) => {
      const g = groups[index];
      return g ? groupKey(g) : index;
    },
  });

  return (
    <div
      style={{ transform: "translateX(var(--chat-shift, 0px))" }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="w-full px-6 pt-12 pb-32" style={{ position: "relative" }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const g = groups[virtualItem.index];
            if (!g) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <motion.div {...blockEnter} className="pb-2">
                  {g.kind === "single" && g.block.kind === "user" && (
                    <UserBlock text={g.block.text} />
                  )}
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
                  {g.kind === "tool" && <ToolRow block={g.block} />}
                </motion.div>
              </div>
            );
          })}
        </div>
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
