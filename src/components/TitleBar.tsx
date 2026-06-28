import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function copySelection() {
  document.execCommand("copy");
}

function cutSelection() {
  document.execCommand("cut");
}

function pasteSelection() {
  document.execCommand("paste");
}

function selectAll() {
  document.execCommand("selectAll");
}

export function TitleBar({
  onNewChat,
  onOpenConnect,
  onOpenSettings,
  onOpenSkills,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
    if (!openMenu) {
      setDropdownPos(null);
      return;
    }
    const trigger = triggerRefs.current[openMenu];
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setOpenMenu(null);
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
        { label: "Cut", shortcut: "Ctrl+X", action: cutSelection },
        { label: "Copy", shortcut: "Ctrl+C", action: copySelection },
        { label: "Paste", shortcut: "Ctrl+V", action: pasteSelection },
        "separator",
        { label: "Select All", shortcut: "Ctrl+A", action: selectAll },
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

  const activeMenu = menus.find((m) => m.label === openMenu);

  return (
    <div className="titlebar">
      <div data-tauri-drag-region className="titlebar-menubar">
        {menus.map((menu) => (
          <button
            key={menu.label}
            ref={(el) => {
              triggerRefs.current[menu.label] = el;
            }}
            type="button"
            className={`titlebar-menu-trigger${openMenu === menu.label ? " menu-open" : ""}`}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => handleMouseEnter(menu.label)}
          >
            <span className="titlebar-menu-label">{menu.label}</span>
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

      {createPortal(
        <AnimatePresence>
          {openMenu && dropdownPos && activeMenu
            ? (() => (
                <motion.div
                  key={openMenu}
                  ref={menuRef}
                  role="menu"
                  className="titlebar-menu-dropdown"
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    transformOrigin: "top left",
                    position: "fixed",
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    zIndex: 9999,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {activeMenu.items.map((item, i) =>
                    item === "separator" ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: separators have no stable id
                      <div key={`${openMenu}-sep-${i}`} className="titlebar-menu-separator" />
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
                </motion.div>
              ))()
            : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
