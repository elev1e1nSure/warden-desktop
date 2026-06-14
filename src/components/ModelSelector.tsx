import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Model } from "../types";

interface ModelSelectorProps {
  models: Model[];
  selected: Model;
  onSelect: (model: Model) => void;
}

export default function ModelSelector({
  models,
  selected,
  onSelect,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = models.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );

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
    if (open) return;
    setQuery("");
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full z-50 mt-1.5 flex max-h-80 w-56 flex-col overflow-hidden rounded-xl bg-surface-raised shadow-xl ring-1 ring-white/[0.08]"
          >
            <div className="border-b border-white/[0.06] px-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent py-2 text-[13px] tracking-[-0.01em] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar p-1">
              {filtered.length === 0 && (
                <p className="px-3 py-1.5 text-[13px] text-text-muted">No models</p>
              )}
              {filtered.map((model) => {
                const active = model.id === selected.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => { onSelect(model); setOpen(false); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span className={`text-[13px] tracking-[-0.01em] ${active ? "text-text-primary" : "text-text-secondary"}`}>
                      {model.name}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-text-muted" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] text-text-secondary transition-all hover:text-text-primary"
      >
        {selected.name}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex opacity-60"
        >
          <ChevronDown className="h-3 w-3" />
        </motion.span>
      </button>
    </div>
  );
}
