import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Model } from "../types";

interface ModelSelectorProps {
  models: Model[];
  selected: Model;
  onSelect: (model: Model) => void;
  align?: "up" | "down";
}

type VirtualRow = { type: "header"; label: string } | { type: "model"; model: Model };

interface ModelRowProps {
  model: Model;
  active: boolean;
  onSelect: (model: Model) => void;
}

const ModelRow = memo(function ModelRow({ model, active, onSelect }: ModelRowProps) {
  return (
    <div
      data-active={active}
      className={`flex items-center rounded-xl p-0.5 transition-colors duration-150 ${
        active ? "bg-fill-active" : "hover:bg-fill-hover"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(model)}
        className="group flex flex-1 items-center justify-between min-w-0 rounded-lg py-1.5 px-2 text-left transition-none"
      >
        <span
          className={`min-w-0 flex-1 truncate text-ui tracking-[-0.01em] transition-colors ${
            active
              ? "text-text-primary font-medium"
              : "text-text-secondary group-hover:text-text-primary"
          }`}
        >
          {model.name}
        </span>
        {active ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-text-secondary" strokeWidth={2.25} />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
    </div>
  );
});

export default function ModelSelector({
  models,
  selected,
  onSelect,
  align = "up",
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("warden.recentModels");
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const handleSelect = useCallback(
    (model: Model) => {
      onSelect(model);
      setRecentIds((prev) => {
        const next = [model.id, ...prev.filter((id) => id !== model.id)].slice(0, 3);
        localStorage.setItem("warden.recentModels", JSON.stringify(next));
        return next;
      });
      setOpen(false);
    },
    [onSelect],
  );

  const filtered = useMemo(
    () => models.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())),
    [models, query],
  );

  // Build the virtual row list: when searching → flat filtered list;
  // when not searching → Recent section (if any) + All section.
  const rows = useMemo((): VirtualRow[] => {
    if (query) {
      return filtered.map((m) => ({ type: "model", model: m }));
    }
    const result: VirtualRow[] = [];
    const recentModels = recentIds
      .map((id) => models.find((m) => m.id === id))
      .filter((m): m is Model => m !== undefined);

    if (recentModels.length > 0) {
      result.push({ type: "header", label: "Recent" });
      for (const m of recentModels) result.push({ type: "model", model: m });
    }
    result.push({ type: "header", label: "All" });
    for (const m of models) result.push({ type: "model", model: m });
    return result;
  }, [query, filtered, models, recentIds]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => (rows[i]?.type === "header" ? 28 : 32),
    overscan: 8,
    getItemKey: (index: number) => {
      const row = rows[index];
      if (!row) return index;
      return row.type === "header" ? `header-${row.label}` : row.model.id;
    },
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional open-only effect
  useLayoutEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    inputRef.current?.focus();
    // Scroll to the active model. One rAF is enough — virtualizer mounts synchronously.
    const activeIndex = rows.findIndex((r) => r.type === "model" && r.model.id === selected.id);
    if (activeIndex >= 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(activeIndex, { align: "center" });
      });
    }
  }, [open]);

  const isDown = align === "down";

  const handleTriggerClick = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos(
        isDown
          ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
          : { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right },
      );
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      {createPortal(
        <AnimatePresence>
          {open && dropdownPos && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: isDown ? -6 : 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isDown ? -6 : 6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                zIndex: 9999,
                transformOrigin: isDown ? "top right" : "bottom right",
                ...dropdownPos,
              }}
              className="accelerate-scale dropdown-glass flex max-h-80 w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl p-1"
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
              <div
                ref={listRef}
                className="flex min-h-0 flex-1 overflow-y-auto no-scrollbar"
                style={{
                  maskImage: "linear-gradient(to bottom, #000 0%, #000 85%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 85%, transparent 100%)",
                }}
              >
                {rows.length === 0 ? (
                  <p className="px-2.5 py-2 text-ui text-text-muted">No models match.</p>
                ) : (
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const row = rows[virtualItem.index];
                      if (!row) return null;

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
                          {row.type === "header" ? (
                            <div className="px-2 pb-0.5 pt-1.5 text-meta font-semibold uppercase tracking-widest text-text-faint">
                              {row.label}
                            </div>
                          ) : (
                            <ModelRow
                              model={row.model}
                              active={row.model.id === selected.id}
                              onSelect={handleSelect}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className={`flex max-w-[360px] items-center gap-1.5 rounded-lg px-2 py-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors hover:bg-fill-hover ${
          open ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <span className="truncate">{selected.name}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex shrink-0 opacity-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>
    </div>
  );
}
