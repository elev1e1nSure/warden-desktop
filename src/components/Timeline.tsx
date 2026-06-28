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
  | { kind: "tool"; block: ToolBlock; key: string }
  // A completed agent work chain: think + tool blocks collapsed into one row.
  // Shown as "Worked for Xs" summary, expandable on click.
  | { kind: "work-chain"; blocks: Block[]; elapsed: number; key: string };

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  let chainStart: number | null = null;

  const flushChainAsIndividual = (end: number) => {
    if (chainStart === null) return;
    for (let j = chainStart; j < end; j++) {
      const cb = blocks[j];
      if (!cb) continue;
      if (cb.kind === "tool") {
        const prev = out[out.length - 1];
        if (prev?.kind === "tool" && toolFamily(prev.block.name) === toolFamily(cb.name)) {
          out[out.length - 1] = { kind: "tool", block: cb, key: prev.key };
        } else {
          out.push({ kind: "tool", block: cb, key: cb.id });
        }
      } else {
        out.push({ kind: "single", block: cb });
      }
    }
    chainStart = null;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;

    if (b.kind === "think" || b.kind === "tool") {
      // Accumulate into a work chain
      if (chainStart === null) chainStart = i;
    } else if (b.kind === "agent-work-end") {
      // Terminate the pending chain with elapsed time
      if (chainStart !== null) {
        const chainBlocks = blocks.slice(chainStart, i);
        const key = blocks[chainStart]?.id ?? b.id;
        out.push({ kind: "work-chain", blocks: chainBlocks, elapsed: b.elapsed, key });
        chainStart = null;
      }
      // agent-work-end is consumed; never emitted as a group itself
    } else {
      // Any other block type: flush pending chain as individual items, then emit
      flushChainAsIndividual(i);
      out.push({ kind: "single", block: b });
    }
  }

  // During streaming: incomplete chain (no agent-work-end yet) — show individually
  flushChainAsIndividual(blocks.length);

  return out;
}

function groupKey(g: Group): string {
  if (g.kind === "work-chain") return g.key;
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <motion.div className="group/user flex flex-col items-end gap-1 pt-3 pb-1">
      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-fill-active px-4 py-3 text-body leading-relaxed text-text-primary">
        {text}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted opacity-0 transition-opacity duration-150 group-hover/user:opacity-100 hover:text-text-secondary"
      >
        <Clipboard className="h-4 w-4" strokeWidth={1.75} />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
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
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group/assistant relative">
      <div
        className={`markdown-body text-body text-text-primary${streamingCaret ? " is-streaming" : ""}`}
      >
        {display.length === 0 ? (
          <span className="inline-block h-[15px] w-[6px] animate-pulse rounded-sm bg-fill-strong align-middle" />
        ) : (
          rendered
        )}
      </div>
      {!live && display.length > 0 && (
        <div className="mt-1 flex h-6 items-center opacity-0 transition-opacity duration-150 group-hover/assistant:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted transition-colors duration-100 hover:text-text-secondary"
          >
            <Clipboard className="h-4 w-4" strokeWidth={1.75} />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
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
        className="group flex items-center gap-1.5 p-0 text-ui-lg text-white/35 transition-colors hover:text-white/60 disabled:cursor-default disabled:hover:text-white/35"
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
                className="absolute inset-0 flex items-center whitespace-nowrap"
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
            <div className="mt-2 pl-5 text-ui leading-[1.7] text-white/30">
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
        <div className="flex items-center gap-1.5 text-ui-lg text-white/35">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          </span>

          <span className="relative inline-flex h-[18px] min-w-[120px] items-center">
            <AnimatePresence initial={false}>
              {running ? (
                <motion.span
                  key="running"
                  {...labelFade}
                  className="absolute inset-0 flex items-center whitespace-nowrap"
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
                    <span className="font-normal text-white/25">{doneLabel.arg}</span>
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

// ─── work chain tree ─────────────────────────────────────────────────────────

// A single expandable "Thought" leaf inside the tree.
function TreeThinkItem({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const hasContent = text.trim().length > 0;
  return (
    <div>
      <button
        type="button"
        disabled={!hasContent}
        onClick={() => hasContent && setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-ui text-white/35 transition-colors hover:text-white/60 disabled:cursor-default disabled:hover:text-white/35"
      >
        {hasContent && (
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="flex h-3 w-3 shrink-0 items-center justify-center opacity-50"
          >
            <ChevronDown className="h-3 w-3" strokeWidth={2} />
          </motion.span>
        )}
        {!hasContent && <span className="h-3 w-3 shrink-0" />}
        <span>Thought</span>
      </button>
      <AnimatePresence initial={false}>
        {open && hasContent && (
          <motion.div {...collapse} className="overflow-hidden">
            <div className="relative ml-4 mt-1 mb-0.5 pl-3 text-ui leading-[1.65] text-white/30">
              <div
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                style={{
                  background:
                    "linear-gradient(to bottom, var(--color-border-subtle) 0%, var(--color-border-subtle) 70%, transparent 100%)",
                }}
              />
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  ...mdComponents,
                  p: (props) => <p {...props} className="my-1" />,
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
}

// A single tool leaf inside the tree.
function TreeToolItem({ block }: { block: Extract<Block, { kind: "tool" }> }) {
  const lbl = toolDescription(block);
  const ic = getToolIcon(block.name, block.args);
  return (
    <div className="flex items-center gap-1.5 text-ui text-white/35">
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center opacity-50">{ic}</span>
      <span>{lbl.verb}</span>
      {lbl.arg && <span className="font-normal text-white/25">{lbl.arg}</span>}
    </div>
  );
}

const WorkChain = memo(function WorkChain({
  blocks,
  elapsed,
}: {
  blocks: Block[];
  elapsed: number;
}) {
  const [open, setOpen] = useState(false);

  // Only count non-empty think blocks and tool blocks for the count badge
  const itemCount = blocks.filter(
    (b) => b.kind === "tool" || (b.kind === "think" && b.text.trim().length > 0),
  ).length;

  return (
    <div className="-ml-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 py-0.5 text-ui-lg text-white/35 transition-colors hover:text-white/60"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="flex"
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          </motion.span>
        </span>
        <span>Worked for {elapsed}s</span>
        {itemCount > 0 && !open && (
          <span className="ml-0.5 text-meta text-white/30 font-normal">
            · {itemCount} {itemCount === 1 ? "step" : "steps"}
          </span>
        )}
      </button>

      {/* ── Tree ───────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div {...collapse} className="overflow-hidden">
            {/* pl-[7px] = chevron center; items indent past the line */}
            <div className="relative ml-[7px] mt-0.5 mb-1 pl-4">
              {/* Vertical connector line with gradient fade at bottom */}
              <div
                className="pointer-events-none absolute left-0 top-[5px] bottom-0 w-px"
                style={{
                  background:
                    "linear-gradient(to bottom, var(--color-border-subtle) 0%, var(--color-border-subtle) 70%, transparent 100%)",
                }}
              />

              {blocks.map((b) => {
                if (b.kind !== "think" && b.kind !== "tool") return null;
                // Skip completely empty think blocks
                if (b.kind === "think" && b.text.trim().length === 0) return null;

                return (
                  <div key={b.id} className="relative flex items-start gap-2 py-[3px]">
                    <div className="flex-1 min-w-0">
                      {b.kind === "think" && <TreeThinkItem text={b.text} />}
                      {b.kind === "tool" && <TreeToolItem block={b} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

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
                <motion.div
                  {...blockEnter}
                  className={
                    g.kind === "single" && (g.block.kind === "user" || g.block.kind === "assistant")
                      ? "pb-4"
                      : "pb-1"
                  }
                >
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
                  {g.kind === "work-chain" && <WorkChain blocks={g.blocks} elapsed={g.elapsed} />}
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
