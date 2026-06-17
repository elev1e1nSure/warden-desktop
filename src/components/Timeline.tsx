import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

function toolLine(b: ToolBlock): string {
  let firstArg = "";
  try {
    const obj = JSON.parse(b.args);
    const val = Object.values(obj)[0];
    firstArg = String(val ?? "")
      .replace(/\n/g, " ")
      .trim();
  } catch {
    firstArg = b.args.replace(/\n/g, " ").trim();
  }
  const short = firstArg.length > 68 ? `${firstArg.slice(0, 68)}…` : firstArg;
  const name = b.name.charAt(0).toUpperCase() + b.name.slice(1);
  const arg = short ? short.charAt(0).toUpperCase() + short.slice(1) : "";
  return arg ? `${name}  ${arg}` : name;
}

function groupKey(g: Group): string {
  return g.kind === "tools" ? (g.items[0]?.id ?? "") : g.block.id;
}

// ─── blocks ──────────────────────────────────────────────────────────────────

function UserBlock({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-fill-active px-4 py-3 text-body leading-relaxed text-text-primary">
        {text}
      </div>
    </div>
  );
}

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
}

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

function AssistantBlock({ text }: { text: string }) {
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
}

function ThinkBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 p-0 text-ui-lg text-text-muted transition-colors hover:text-text-secondary"
      >
        <motion.span
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
}

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
                  {toolLine(t)}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

export default function Timeline({
  blocks,
  generation = 0,
  thinking = false,
  follow = true,
}: {
  blocks: Block[];
  generation?: number;
  thinking?: boolean;
  follow?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!follow) return;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [follow]);

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

        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {lightbox && (
          <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
