import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, MessageCircle, SlidersHorizontal, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import Tooltip from "./Tooltip";

type ModeValue = "ask" | "auto" | "custom";

const MODES: {
  value: ModeValue;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  description: string;
}[] = [
  {
    value: "ask",
    label: "Ask",
    Icon: MessageCircle,
    description: "Confirms before each action",
  },
  {
    value: "auto",
    label: "Auto",
    Icon: Zap,
    description: "Runs actions without asking",
  },
  {
    value: "custom",
    label: "Custom",
    Icon: SlidersHorizontal,
    description: "Uses your permission settings",
  },
];

interface ModeToggleProps {
  mode: ModeValue;
  hasCustomPermissions?: boolean;
  disabled?: boolean;
  onSetMode: (mode: ModeValue) => void;
  onOpen?: () => void;
}

export default function ModeToggle({
  mode,
  hasCustomPermissions,
  disabled,
  onSetMode,
  onOpen,
}: ModeToggleProps) {
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

  const handleSelect = (value: ModeValue) => {
    if (value !== mode) onSetMode(value);
    setOpen(false);
  };

  // mode is always one of the three known values, find() won't miss
  // biome-ignore lint/style/noNonNullAssertion: mode is constrained to ModeValue
  const current = MODES.find((m) => m.value === mode)!;

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "bottom left" }}
            className="accelerate-scale absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border-2 border-line bg-[#1a1a1a] p-1 shadow-2xl flex flex-col gap-0.5"
          >
            {MODES.map(({ value, label, Icon }) => {
              const active = value === mode;
              const isCustomUnavailable = value === "custom" && !hasCustomPermissions;

              return (
                <button
                  key={value}
                  type="button"
                  disabled={isCustomUnavailable}
                  onClick={() => handleSelect(value)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${
                    isCustomUnavailable ? "opacity-30 cursor-not-allowed" : "hover:bg-fill-hover"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                      active && value === "auto"
                        ? "text-accent"
                        : active && value === "custom"
                          ? "text-amber-100/80"
                          : active
                            ? "text-text-primary"
                            : isCustomUnavailable
                              ? "text-text-muted"
                              : "text-text-muted group-hover:text-text-secondary"
                    }`}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span
                    className={`flex-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors ${
                      active && value === "auto"
                        ? "text-accent"
                        : active && value === "custom"
                          ? "text-amber-100/80"
                          : active
                            ? "text-text-primary"
                            : "text-text-secondary"
                    }`}
                  >
                    {label}
                  </span>
                  {active ? (
                    <Check
                      className={`h-3 w-3 shrink-0 ${
                        value === "auto"
                          ? "text-accent"
                          : value === "custom"
                            ? "text-amber-100/80"
                            : "text-text-secondary"
                      }`}
                      strokeWidth={2.25}
                    />
                  ) : (
                    <span className="h-3 w-3 shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <Tooltip content={current.description} side="top">
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (!open) onOpen?.();
            setOpen((v) => !v);
          }}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors duration-150 disabled:opacity-40 ${
            mode === "auto"
              ? "text-accent hover:bg-fill-hover"
              : mode === "custom"
                ? "text-amber-100/80 hover:bg-fill-hover"
                : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
          }`}
        >
          <current.Icon className="h-4 w-4" strokeWidth={2.25} />
          {current.label}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex opacity-50"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      </Tooltip>
    </div>
  );
}
