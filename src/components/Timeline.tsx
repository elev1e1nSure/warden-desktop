import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Block } from "../types";

// ─── types ──────────────────────────────────────────────────────────────────

type ToolBlock = Extract<Block, { kind: "tool" }>;

type Group =
  | { kind: "single"; block: Block }
  | { kind: "tools"; items: ToolBlock[] };

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.kind === "tool") {
      const run: ToolBlock[] = [];
      while (i < blocks.length && blocks[i].kind === "tool") {
        run.push(blocks[i] as ToolBlock);
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
  const short = firstArg.length > 68 ? firstArg.slice(0, 68) + "…" : firstArg;
  const name = b.name.charAt(0).toUpperCase() + b.name.slice(1);
  const arg = short ? short.charAt(0).toUpperCase() + short.slice(1) : "";
  return arg ? `${name}  ${arg}` : name;
}

function groupKey(g: Group): string {
  return g.kind === "tools" ? g.items[0].id : g.block.id;
}

// ─── blocks ──────────────────────────────────────────────────────────────────

function UserBlock({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-3 text-[15px] leading-relaxed text-white">
        {text}
      </div>
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-white/[0.06] px-[5px] py-[1px] font-mono text-[12.5px] text-[#bbb]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function AssistantBlock({ text }: { text: string }) {
  return (
    <div className="text-[15px] leading-[1.8] text-[#e8e8e8]">
      {text.length === 0 ? (
        <span className="inline-block h-[14px] w-[5px] animate-pulse rounded-sm bg-[#3a3a3a] align-middle" />
      ) : (
        text.split("\n").map((line, i, arr) => (
          <span key={i}>
            {renderInline(line)}
            {i < arr.length - 1 && <br />}
          </span>
        ))
      )}
    </div>
  );
}

function ThinkBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 p-0 text-[14px] text-text-muted transition-colors hover:text-text-secondary"
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          className="flex shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5" />
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
            <p className="mt-2 whitespace-pre-wrap break-words pl-4 text-[13.5px] leading-[1.7] text-[#666]">
              {text}
            </p>
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
        className="flex items-center gap-1 p-0 text-[14px] text-text-muted transition-colors hover:text-text-secondary disabled:cursor-default disabled:hover:text-text-muted"
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
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </span>
        <span>
          {running
            ? "Running…"
            : `Ran ${n} command${n === 1 ? "" : "s"}`}
        </span>
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
                <li
                  key={t.id}
                  className="text-[13.5px] leading-[1.65] text-[#666]"
                >
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
    <p className="shimmer-text pl-[18px] text-[14px] font-normal">Thinking</p>
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
  const groups = groupBlocks(blocks);

  useEffect(() => {
    if (!follow) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks, thinking, follow]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 pt-12 pb-8">
      {groups.map((g) => (
        <motion.div
          key={`${generation}-${groupKey(g)}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {g.kind === "single" && g.block.kind === "user" && (
            <UserBlock text={g.block.text} />
          )}
          {g.kind === "single" && g.block.kind === "assistant" && (
            <AssistantBlock text={g.block.text} />
          )}
          {g.kind === "single" && g.block.kind === "think" && (
            <ThinkBlock text={g.block.text} />
          )}
          {g.kind === "single" && g.block.kind === "error" && (
            <p className="text-[13px] text-[#c05050]">{g.block.text}</p>
          )}
          {g.kind === "tools" && <ToolGroup items={g.items} />}
        </motion.div>
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
  );
}
