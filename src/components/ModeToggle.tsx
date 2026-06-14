import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, MessageSquare, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Tooltip from "./Tooltip";

const MODES = [
  { value: "ask" as const, label: "Ask", Icon: MessageSquare, description: "Confirms before each action" },
  { value: "auto" as const, label: "Auto", Icon: Zap, description: "Runs actions without asking" },
];

interface ModeToggleProps {
  auto: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export default function ModeToggle({ auto, disabled, onToggle }: ModeToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const handleSelect = (value: "auto" | "ask") => {
    if ((value === "auto") !== auto) onToggle();
    setOpen(false);
  };

  const current = MODES.find((m) => m.value === (auto ? "auto" : "ask"))!;

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-full left-0 z-50 mb-2 w-36 overflow-hidden rounded-xl bg-surface-raised p-1 shadow-xl ring-1 ring-white/[0.08]"
          >
            {MODES.map(({ value, label, Icon }) => {
              const active = (value === "auto") === auto;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect(value)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors ${
                    active ? "" : "hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-text-secondary" : "text-text-muted"}`} />
                  <span className={`flex-1 text-[13px] tracking-[-0.01em] ${active ? "text-text-primary" : "text-text-secondary"}`}>
                    {label}
                  </span>
                  {active && <Check className="h-3 w-3 shrink-0 text-text-muted" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <Tooltip content={current.description} side="top">
        <button
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          className={`flex items-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] transition-all disabled:opacity-40 ${
            auto ? "text-[#8ab8d4] hover:text-[#9fc5db]" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <current.Icon className="h-3 w-3" />
          {current.label}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="flex opacity-50">
            <ChevronDown className="h-3 w-3" />
          </motion.span>
        </button>
      </Tooltip>
    </div>
  );
}
