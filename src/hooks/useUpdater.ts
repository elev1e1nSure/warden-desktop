import { useEffect } from "react";
import { api } from "../api/client";
import { toast } from "../components/Toaster";

export function useUpdater(): void {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;
        toast(`Update available: v${update.version}`, {
          description: "A new version of Warden is ready to install.",
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: "Install & Restart",
            onClick: async () => {
              try {
                // Stop the backend before the installer tries to overwrite it.
                await api.shutdown().catch(() => {});
                await new Promise((r) => setTimeout(r, 1500));
                const { relaunch } = await import("@tauri-apps/plugin-process");
                await update.downloadAndInstall();
                await relaunch();
              } catch {
                toast.error("Update failed. Download the latest version manually.");
              }
            },
          },
        });
      } catch {
        // Not in Tauri, updater not configured, or no update — all non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
