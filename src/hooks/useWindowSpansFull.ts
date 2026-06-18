import { useEffect, useState } from "react";

export function useWindowSpansFull(): boolean {
  const [spansFull, setSpansFull] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let timeoutId: number | undefined;

    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const sync = async () => {
          if (cancelled) return;
          try {
            const [fs, mx] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
            if (!cancelled) setSpansFull(fs || mx);
          } catch {
            // not running inside Tauri or window API failed — keep default
          }
        };

        const debouncedSync = () => {
          if (timeoutId) window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(sync, 150);
        };

        await sync();
        if (cancelled) return;

        const u1 = await win.listen("tauri://enter-fullscreen", debouncedSync);
        if (cancelled) return;
        const u2 = await win.listen("tauri://leave-fullscreen", debouncedSync);
        if (cancelled) return;
        const u3 = await win.listen("tauri://maximize", debouncedSync);
        if (cancelled) return;
        const u4 = await win.listen("tauri://unmaximize", debouncedSync);
        if (cancelled) return;
        const u5 = await win.listen("tauri://resize", debouncedSync);

        window.addEventListener("resize", debouncedSync);

        unlisten = () => {
          u1();
          u2();
          u3();
          u4();
          u5();
          window.removeEventListener("resize", debouncedSync);
        };
      } catch {
        // not running inside Tauri (e.g. plain `vite dev`) — keep default
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      unlisten?.();
    };
  }, []);

  return spansFull;
}
