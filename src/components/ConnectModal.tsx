import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { loadConnection, saveConnection } from "../api/session";

interface ConnectModalProps {
  onConnected: () => void;
  onClose?: () => void;
}

export default function ConnectModal({ onConnected, onClose }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = loadConnection();
    if (saved?.apiKey) setApiKey(saved.apiKey);
  }, []);

  const submit = async () => {
    setError("");
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setBusy(true);
    try {
      const res = await api.connect(apiKey.trim());
      if (res.ok) {
        saveConnection({ apiKey: apiKey.trim() });
        onConnected();
      } else {
        setError(res.error || "connection failed");
      }
    } catch (e) {
      setError(`could not reach backend: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-surface-raised shadow-2xl"
      >
        <div className="border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">Connect OpenRouter</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Enter API key. Pick model from status bar after connect.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="sk-or-v1-..."
              className="w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-white/25 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
            >
              Cancel
            </button>
          )}
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Connecting..." : "Connect"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
