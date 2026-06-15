import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Model } from "../types";

interface ModelSelectorProps {
  models: Model[];
  selected: Model;
  onSelect: (model: Model) => void;
}

export default function ModelSelector({ models, selected, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = models.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus the filter as the menu opens so the user can type straight away.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full z-50 mt-2 flex max-h-80 w-64 flex-col overflow-hidden rounded-2xl bg-surface-raised p-1.5 shadow-2xl shadow-black/40 ring-1 ring-hairline"
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.75} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models…"
                className="w-full bg-transparent text-ui tracking-[-0.01em] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div className="mx-1 mb-1 mt-0.5 h-px bg-hairline" />
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
              {filtered.length === 0 && (
                <p className="px-2.5 py-2 text-ui text-text-muted">No models match.</p>
              )}
              {filtered.map((model) => {
                const active = model.id === selected.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelect(model);
                      setOpen(false);
                    }}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${
                      active ? "bg-fill-active" : "hover:bg-fill-hover"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-ui tracking-[-0.01em] transition-colors ${
                        active
                          ? "text-text-primary"
                          : "text-text-secondary group-hover:text-text-primary"
                      }`}
                    >
                      {model.name}
                    </span>
                    {active ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-text-secondary"
                        strokeWidth={2.25}
                      />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex max-w-[240px] items-center gap-1.5 rounded-md px-1 py-0.5 text-ui font-medium tracking-[-0.01em] transition-colors hover:bg-fill-hover ${
          open ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <span className="truncate">{selected.name}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex shrink-0 opacity-50"
        >
          <ChevronDown className="h-3 w-3" />
        </motion.span>
      </button>
    </div>
  );
}
