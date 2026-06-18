import { motion } from "framer-motion";
import { useEffect } from "react";
import type { ConfirmEvent } from "../api/types";

interface ConfirmModalProps {
  request: ConfirmEvent;
  onResolve: (ok: boolean) => void;
}

export default function ConfirmModal({ request, onResolve }: ConfirmModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve(false);
      if (e.key === "Enter") onResolve(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onResolve]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border-2 border-line bg-[rgba(22,22,22,0.88)]"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-ui-lg font-semibold tracking-[-0.01em] text-text-primary">
          {request.title || "Action needs confirmation"}
        </p>
        <p className="mt-0.5 text-ui text-text-muted">
          <span className="font-mono">{request.tool}</span>
          {request.risk && request.risk !== "confirm" && (
            <span className="ml-1.5 text-text-faint">· {request.risk}</span>
          )}
        </p>
      </div>

      {/* Details */}
      {(request.summary || (request.details?.length ?? 0) > 0 || request.preview) && (
        <div className="space-y-2 px-4 pb-3">
          {request.summary && (
            <p className="text-ui leading-relaxed text-text-secondary">{request.summary}</p>
          )}
          {(request.details?.length ?? 0) > 0 && (
            <div className="rounded-xl bg-fill-subtle px-3 py-2.5">
              <ul className="space-y-1 text-ui text-text-secondary">
                {request.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {request.preview && (
            <pre className="max-h-32 overflow-auto rounded-xl bg-fill-subtle px-3 py-2.5 font-mono text-[12px] leading-relaxed text-text-secondary">
              {request.preview}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 px-3 pb-3">
        <button
          type="button"
          onClick={() => onResolve(false)}
          className="rounded-xl px-3 py-2 text-ui font-medium text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onResolve(true)}
          className="rounded-xl bg-white px-3 py-2 text-ui font-semibold text-black transition-colors hover:bg-white/90"
        >
          Run anyway
        </button>
      </div>
    </motion.div>
  );
}
