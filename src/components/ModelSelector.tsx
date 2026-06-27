import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, Star } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Model } from "../types";

interface ModelSelectorProps {
  models: Model[];
  selected: Model;
  onSelect: (model: Model) => void;
  align?: "up" | "down";
}

interface RowProps {
  model: Model;
  active: boolean;
  isFav: boolean;
  onSelect: (model: Model) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

// Memoized row so re-renders triggered by scrolling / query changes only touch
// the rows whose props actually changed, not every visible item.
const ModelRow = memo(function ModelRow({
  model,
  active,
  isFav,
  onSelect,
  onToggleFavorite,
}: RowProps) {
  return (
    <div
      data-active={active}
      className={`flex items-center gap-1 rounded-xl p-0.5 transition-colors duration-150 ${
        active ? "bg-fill-active" : "hover:bg-fill-hover"
      }`}
    >
      <button
        type="button"
        onClick={(e) => onToggleFavorite(model.id, e)}
        onMouseDown={(e) => e.preventDefault()}
        className="flex shrink-0 items-center justify-center pl-2 pr-1 text-text-muted hover:text-text-primary transition-colors"
        title={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Star
          className={`h-3.5 w-3.5 ${isFav ? "text-white fill-white" : "text-white/40"}`}
          strokeWidth={1.5}
        />
      </button>
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
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("warden.favoriteModels");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      localStorage.setItem("warden.favoriteModels", JSON.stringify(next));
      return next;
    });
  }, []);

  // Sort: starred models first, then maintain original order. Memoized so
  // query keystrokes don't re-sort the whole 100+ list every render.
  const sorted = useMemo(
    () =>
      [...models].sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      }),
    [models, favorites],
  );

  const filtered = useMemo(
    () => sorted.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  );

  // Virtualize the list — with 100+ OpenRouter models, mounting a motion.div
  // per row was the main source of open/scroll jank (each one runs a layout
  // measurement in useLayoutEffect). Now only the ~15 visible rows mount.
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 8,
    getItemKey: (index: number) => filtered[index]?.id ?? index,
  });

  const handleSelect = useCallback(
    (model: Model) => {
      onSelect(model);
      setOpen(false);
    },
    [onSelect],
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

  // Only re-scroll when the menu opens — not on every keystroke / selection
  // change, which would fight the user's own scrolling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional open-only effect
  useLayoutEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    inputRef.current?.focus();
    // Scroll the active model to the center. One rAF is enough — the
    // virtualizer mounts its items synchronously in the same commit. The old
    // double-rAF caused a visible one-frame jump before the scroll landed.
    const activeIndex = filtered.findIndex((m) => m.id === selected.id);
    if (activeIndex >= 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(activeIndex, { align: "center" });
      });
    }
  }, [open]);

  const isDown = align === "down";

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: isDown ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isDown ? -6 : 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: isDown ? "top right" : "bottom right" }}
            className={`accelerate-scale absolute right-0 z-50 flex max-h-80 w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border-2 border-line bg-[#1a1a1a] p-1 shadow-2xl ${
              isDown ? "top-full mt-2" : "bottom-full mb-2"
            }`}
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
                maskImage: "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
              }}
            >
              {filtered.length === 0 ? (
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
                    const model = filtered[virtualItem.index];
                    if (!model) return null;
                    const active = model.id === selected.id;
                    const isFav = favorites.includes(model.id);
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
                        <ModelRow
                          model={model}
                          active={active}
                          isFav={isFav}
                          onSelect={handleSelect}
                          onToggleFavorite={toggleFavorite}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
