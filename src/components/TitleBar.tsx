import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void)[] = [];

    (async () => {
      try {
        const win = getCurrentWindow();
        const [isMaxed] = await Promise.all([win.isMaximized()]);
        if (!cancelled) setMaximized(isMaxed);

        const u1 = await win.listen("tauri://maximize", () => {
          if (!cancelled) setMaximized(true);
        });
        const u2 = await win.listen("tauri://unmaximize", () => {
          if (!cancelled) setMaximized(false);
        });
        unlisten = [u1, u2];
      } catch {
        // not running inside Tauri
      }
    })();

    return () => {
      cancelled = true;
      for (const fn of unlisten) fn();
    };
  }, []);

  const handleMinimize = () => {
    try {
      getCurrentWindow().minimize();
    } catch {
      /* ignore */
    }
  };

  const handleToggleMaximize = () => {
    try {
      getCurrentWindow().toggleMaximize();
    } catch {
      /* ignore */
    }
  };

  const handleClose = () => {
    try {
      getCurrentWindow().close();
    } catch {
      /* ignore */
    }
  };

  return (
    <div data-tauri-drag-region className="titlebar">
      <span className="titlebar-label">Warden</span>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={handleToggleMaximize}
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <rect
                x="3"
                y="0.5"
                width="8.5"
                height="8.5"
                rx="0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <rect
                x="0.5"
                y="3"
                width="8.5"
                height="8.5"
                rx="0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                rx="0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
