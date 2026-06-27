import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { loadConnection, saveConnection } from "../api/session";
import { useEscape } from "../hooks/useEscape";

interface ConnectModalProps {
  onConnected: () => void;
  onClose?: () => void;
}

export default function ConnectModal({ onConnected, onClose }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const saved = loadConnection();
    if (saved?.apiKey) setApiKey(saved.apiKey);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEscape(() => onClose?.());

  const submit = async () => {
    setError("");
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setBusy(true);
    try {
      const res = await api.connect(apiKey.trim());
      if (!mountedRef.current) return;
      if (res.ok) {
        saveConnection({ apiKey: apiKey.trim() });
        onConnected();
      } else {
        setError(res.error || "connection failed");
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(`could not reach backend: ${String(e)}`);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="accelerate-scale w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-2xl"
      >
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="text-body font-semibold text-text-primary">Connect OpenRouter</h2>
          <p className="mt-0.5 text-meta text-text-muted">
            Enter API key. Pick model from status bar after connect.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-meta text-text-muted">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="sk-or-v1-..."
              className="w-full rounded-lg border border-line bg-black/20 px-3 py-2 text-ui-lg text-text-primary placeholder:text-text-muted focus:border-white/25 focus:outline-none"
            />
          </label>

          {error && <p className="text-ui-lg text-danger">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-ui-lg font-medium text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-ui-lg font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Connecting..." : "Connect"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
