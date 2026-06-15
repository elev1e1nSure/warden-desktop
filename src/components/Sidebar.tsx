import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MoreHorizontal, Pencil, Plug, Sparkles, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_SPRING } from "../motion";
import type { Chat } from "../types";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  width: number;
  skillsActive?: boolean;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSkills: () => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

function NavButton({ icon, label, onClick, disabled }: NavButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none ${
        disabled
          ? "cursor-default text-text-faint"
          : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="truncate text-ui-lg font-medium tracking-[-0.01em] whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

export default function Sidebar({
  chats,
  activeChatId,
  width,
  skillsActive,
  onSelectChat,
  onNewChat,
  onOpenSkills,
  onRenameChat,
  onDeleteChat,
}: SidebarProps) {
  const [chatsOpen, setChatsOpen] = useState(true);
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    if (!menuChatId) {
      setMenuPos(null);
      return;
    }
    const trigger = menuTriggerRef.current[menuChatId];
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    }
    // Close on any click outside the menu or its trigger. We use 'click'
    // (not 'mousedown') so the trigger's own click that *opens* the menu
    // doesn't immediately close it again.
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setMenuChatId(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuChatId]);

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRenameChat(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <aside
      style={{ width }}
      className="relative flex h-full min-h-0 shrink-0 flex-col bg-sidebar"
    >
      {/* Primary nav */}
      <nav className="flex flex-col gap-px overflow-hidden px-2 pt-2">
        <NavButton icon={<SquarePen strokeWidth={1.75} />} label="New Chat" onClick={onNewChat} />
        <button
          type="button"
          onClick={onOpenSkills}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none ${
            skillsActive
              ? "bg-fill-active text-text-primary"
              : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
          }`}
        >
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            <Sparkles strokeWidth={1.75} />
          </span>
          <span className="truncate text-ui-lg font-medium tracking-[-0.01em] whitespace-nowrap">
            Skills
          </span>
        </button>
        <NavButton icon={<Plug strokeWidth={1.75} />} label="MCPs" disabled />
      </nav>

      {/* Chats section */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col px-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <button
            type="button"
            onClick={() => setChatsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-2 py-1.5 text-ui font-semibold text-text-muted hover:text-text-secondary"
          >
            Chats
            <motion.span
              animate={{ rotate: chatsOpen ? 0 : -90 }}
              transition={{ duration: 0.15 }}
              className="flex shrink-0"
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {chatsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="sidebar-scroll overflow-y-auto overflow-x-hidden">
                  <div className="flex flex-col gap-0.5 pt-1 pb-2">
                    {chats.map((chat) => {
                      const active = chat.id === activeChatId;
                      const menuOpen = menuChatId === chat.id;
                      const renaming = renamingId === chat.id;

                      return (
                        // biome-ignore lint/a11y/useSemanticElements: div[role="button"] needed to contain input+button children
                        <div
                          key={chat.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => !renaming && onSelectChat(chat.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !renaming) onSelectChat(chat.id); }}
                          className={`group relative flex min-w-0 cursor-pointer items-center rounded-xl px-2.5 py-1.5 ${
                            active ? "" : "hover:bg-fill-hover"
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="chat-active"
                              transition={HIGHLIGHT_SPRING}
                              className="absolute inset-0 rounded-xl bg-fill-active"
                            />
                          )}
                          {renaming ? (
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(chat.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onBlur={() => commitRename(chat.id)}
                              className="relative z-10 min-w-0 flex-1 bg-transparent text-ui-lg font-medium tracking-[-0.01em] text-text-primary outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              className="relative z-10 min-w-0 flex-1 text-left">
                              <span
                                className={`block truncate text-ui-lg tracking-[-0.01em] ${
                                  active ? "font-medium text-text-primary" : "font-normal text-text-secondary"
                                }`}
                              >
                                {chat.title}
                              </span>
                            </button>
                          )}

                          {/* Three-dots trigger */}
                          {!renaming && (
                            <button
                              type="button"
                              aria-label="Chat options"
                              ref={(el) => {
                                menuTriggerRef.current[chat.id] = el;
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuChatId(menuOpen ? null : chat.id);
                              }}
                              className={`relative z-10 ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-opacity hover:text-text-secondary ${
                                menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          )}

                          {/* Dropdown is rendered into document.body via portal
                              so the scroll container / aside / motion nodes
                              can never clip it. */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {createPortal(
        <AnimatePresence>
          {menuChatId && menuPos
            ? (() => {
                const chat = chats.find((c) => c.id === menuChatId);
                if (!chat) return null;
                return (
                  <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.97, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -4 }}
                    transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      position: "fixed",
                      top: menuPos.top,
                      left: menuPos.left,
                      transform: "translateX(-100%)",
                      transformOrigin: "top right",
                      zIndex: 9999,
                    }}
                    className="w-36 overflow-hidden rounded-xl bg-surface-raised p-1 shadow-xl ring-1 ring-hairline"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(chat.id);
                        setRenameValue(chat.title);
                        setMenuChatId(null);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-ui tracking-[-0.01em] text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteChat(chat.id);
                        setMenuChatId(null);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-ui tracking-[-0.01em] text-danger transition-colors hover:bg-fill-hover hover:text-danger-hover"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      Delete
                    </button>
                  </motion.div>
                );
              })()
            : null}
        </AnimatePresence>,
        document.body,
      )}
    </aside>
  );
}
