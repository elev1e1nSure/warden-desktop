import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    let rafId: number;

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      if (!triggerRect || !tooltipRect) return;

      let top = triggerRect.top;
      let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

      switch (side) {
        case "top":
          top = triggerRect.top - tooltipRect.height - 8;
          break;
        case "bottom":
          top = triggerRect.bottom + 8;
          break;
        case "left":
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case "right":
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + 8;
          break;
      }

      setPosition({ top, left });

      rafId = requestAnimationFrame(() => {
        const el = tooltipRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.left < 8) {
          setPosition((p) => ({ ...p, left: 8 }));
        } else if (r.right > window.innerWidth - 8) {
          setPosition((p) => ({ ...p, left: window.innerWidth - r.width - 8 }));
        }
        if (r.top < 8) {
          setPosition((p) => ({ ...p, top: 8 }));
        } else if (r.bottom > window.innerHeight - 8) {
          setPosition((p) => ({ ...p, top: window.innerHeight - r.height - 8 }));
        }
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible, side]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: div[role="button"] wraps children that are often buttons; changing to <button> would nest interactive elements
    <div
      ref={triggerRef}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setVisible(false);
      }}
      className="relative inline-flex"
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
            }}
            className="pointer-events-none z-50 whitespace-nowrap rounded-md bg-surface-raised px-2.5 py-1.5 text-meta font-medium text-text-primary shadow-lg"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
