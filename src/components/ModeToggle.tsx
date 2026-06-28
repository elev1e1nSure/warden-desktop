import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Tooltip from "./Tooltip";

type ModeValue = "ask" | "auto" | "custom";

const MODES: {
  value: ModeValue;
  label: string;
  description: string;
}[] = [
  {
    value: "ask",
    label: "Ask",
    description: "Confirms before each action",
  },
  {
    value: "auto",
    label: "Auto",
    description: "Runs actions without asking",
  },
  {
    value: "custom",
    label: "Custom",
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const handleSelect = (value: ModeValue) => {
    if (value !== mode) onSetMode(value);
    setOpen(false);
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    if (!open) onOpen?.();
    setOpen((v) => !v);
  };

  // mode is always one of the three known values, find() won't miss
  // biome-ignore lint/style/noNonNullAssertion: mode is constrained to ModeValue
  const current = MODES.find((m) => m.value === mode)!;

  return (
    <div className="relative">
      {createPortal(
        <AnimatePresence>
          {open && dropdownPos && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                zIndex: 9999,
                transformOrigin: "bottom left",
                ...dropdownPos,
              }}
              className="accelerate-scale dropdown-glass w-44 overflow-hidden rounded-xl p-1 flex flex-col gap-0.5"
            >
              {MODES.map(({ value, label }) => {
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
                    <span
                      className={`flex-1 text-[15px] font-medium tracking-[-0.01em] transition-colors ${
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
        </AnimatePresence>,
        document.body,
      )}

      <Tooltip content={current.description} side="top">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTriggerClick}
          disabled={disabled}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors duration-150 disabled:opacity-40 ${
            mode === "auto"
              ? "text-accent hover:bg-fill-hover"
              : mode === "custom"
                ? "text-amber-100/80 hover:bg-fill-hover"
                : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
          }`}
        >
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
