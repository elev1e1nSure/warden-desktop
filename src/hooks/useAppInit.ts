import { useEffect } from "react";
import { api, setAuthToken } from "../api/client";
import { loadConnection, verifyBackend } from "../api/session";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface UseAppInitParams {
  refreshStatus: () => Promise<{ connected: boolean; model: string } | null>;
  loadModels: () => Promise<string[]>;
  loadChats: () => Promise<unknown>;
}

export function useAppInit({ refreshStatus, loadModels, loadChats }: UseAppInitParams): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 90; i++) {
        if (cancelled) return;
        if (await api.health()) break;
        await sleep(1000);
      }
      if (cancelled) return;

      // Read the auth token only after the backend is up — the .token file
      // is written by the backend on startup, so it doesn't exist before that.
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const token = await invoke<string>("get_backend_token");
        if (token) setAuthToken(token);
      } catch {
        // Not running inside Tauri or token not available — dev mode, WARDEN_DEV=1
      }

      const s = await refreshStatus();
      await loadChats();
      if (cancelled || !s) return;
      if (s.connected) {
        const list = await loadModels();
        const savedModel = localStorage.getItem("warden.lastModel");
        if (savedModel && list.includes(savedModel) && s.model !== savedModel) {
          try {
            await api.setModel(savedModel);
            await refreshStatus();
          } catch {
            // ignore
          }
        }
      } else {
        // Auto-reconnect with the last used credentials so a model never has to
        // be picked on launch. No modal is forced — connect via the status bar.
        const saved = loadConnection();
        if (saved) {
          try {
            // Verify the backend is our own Warden instance before sending the
            // API key — protects against a rogue process listening on :8765.
            const ok = await verifyBackend();
            if (!ok) return;
            const r = await api.connect(saved.apiKey);
            if (!cancelled && r.ok) {
              await refreshStatus();
              const list = await loadModels();
              const savedModel = localStorage.getItem("warden.lastModel");
              if (savedModel && list.includes(savedModel)) {
                try {
                  await api.setModel(savedModel);
                  await refreshStatus();
                } catch {
                  // ignore
                }
              }
              await loadChats();
            }
          } catch {
            // ignore — user can connect manually
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus, loadModels, loadChats]);
}
