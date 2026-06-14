import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { ConfirmEvent } from "../api/types";

interface ConfirmModalProps {
  request: ConfirmEvent;
  onResolve: (ok: boolean) => void;
}

const RISK_LABEL: Record<string, string> = {
  confirm: "Needs confirmation",
  blocked: "Blocked",
};

export default function ConfirmModal({ request, onResolve }: ConfirmModalProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-surface-raised shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#e0b341]" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text-primary">
              {request.title || "Dangerous action"}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              <span className="font-medium text-[#e0b341]">
                {RISK_LABEL[request.risk] ?? request.risk}
              </span>
              {" · "}
              <span className="font-mono text-[#38BDF8]">{request.tool}</span>
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          {request.summary && (
            <p className="text-sm text-text-primary leading-relaxed">
              {request.summary}
            </p>
          )}

          {request.details?.length > 0 && (
            <div className="rounded-lg bg-white/[0.03] p-3">
              <ul className="space-y-1.5 text-sm text-text-secondary">
                {request.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {request.preview && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 text-text-secondary">
              {request.preview}
            </pre>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button
            onClick={() => onResolve(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(true)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Run anyway
          </button>
        </div>
      </motion.div>
    </div>
  );
}
