import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";

interface TitleBarProps {
  onNewChat: () => void;
  onOpenConnect: () => void;
  onOpenSettings: () => void;
  onOpenSkills: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
}

interface MenuDef {
  label: string;
  items: (MenuItem | "separator")[];
}

function simulateKey(key: string, ctrl = true) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: ctrl, bubbles: true }));
}

export function TitleBar({
  onNewChat,
  onOpenConnect,
  onOpenSettings,
  onOpenSkills,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "New Chat", shortcut: "Ctrl+N", action: onNewChat },
        "separator",
        { label: "Connect to Server...", shortcut: "Ctrl+Shift+C", action: onOpenConnect },
        "separator",
        { label: "Settings", action: onOpenSettings },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Cut", shortcut: "Ctrl+X", action: () => simulateKey("x") },
        { label: "Copy", shortcut: "Ctrl+C", action: () => simulateKey("c") },
        { label: "Paste", shortcut: "Ctrl+V", action: () => simulateKey("v") },
        "separator",
        { label: "Select All", shortcut: "Ctrl+A", action: () => simulateKey("a") },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Skills", action: onOpenSkills },
        "separator",
        {
          label: "Toggle Full Screen",
          action: async () => {
            try {
              const win = getCurrentWindow();
              await win.setFullscreen(!(await win.isFullscreen()));
            } catch {
              /* ignore */
            }
          },
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About Warden",
          action: () => {
            // noop for now
          },
        },
      ],
    },
  ];

  const handleMouseEnter = (label: string) => {
    if (openMenu) setOpenMenu(label);
  };

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
    <div className="titlebar">
      <div ref={menuRef} data-tauri-drag-region className="titlebar-menubar">
        {menus.map((menu) => (
          <button
            key={menu.label}
            type="button"
            className={`titlebar-menu-trigger${openMenu === menu.label ? " menu-open" : ""}`}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => handleMouseEnter(menu.label)}
          >
            <span className="titlebar-menu-label">{menu.label}</span>
            {openMenu === menu.label && (
              <div
                role="menu"
                className="titlebar-menu-dropdown"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {menu.items.map((item, i) =>
                  item === "separator" ? (
                    <div key={`${menu.label}-sep-${i}`} className="titlebar-menu-separator" />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      className="titlebar-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(null);
                        item.action();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="titlebar-menu-shortcut">{item.shortcut}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </button>
        ))}
      </div>
      <div data-tauri-drag-region className="titlebar-spacer" />
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M1 6h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
                strokeWidth="1.75"
              />
              <rect
                x="0.5"
                y="3"
                width="8.5"
                height="8.5"
                rx="0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
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
                strokeWidth="1.75"
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
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
