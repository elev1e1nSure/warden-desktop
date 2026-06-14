import {
  IconApps,
  IconChevronDown,
  IconEdit,
  IconSparkles,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
}

function NavButton({ icon, label, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[#d4d4d4] hover:bg-white/[0.06] hover:text-white"
    >
      <span className="shrink-0 [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
      <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] whitespace-nowrap">
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuChatId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuChatId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuChatId]);

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRenameChat(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
      <motion.aside
        initial={false}
        animate={{ width }}
        transition={{ type: "spring", stiffness: 800, damping: 60 }}
        className="relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar"
      >
        {/* Primary nav */}
        <nav className="flex flex-col gap-px px-2 pt-2">
          <NavButton icon={<IconEdit />} label="New Chat" onClick={onNewChat} />
          <button
            onClick={onOpenSkills}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none ${
              skillsActive
                ? "bg-white/[0.09] text-white"
                : "text-[#d4d4d4] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <span className="shrink-0 [&>svg]:h-[15px] [&>svg]:w-[15px]"><IconSparkles /></span>
            <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] whitespace-nowrap">Skills</span>
          </button>
          <NavButton icon={<IconApps />} label="MCPs" />
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
              onClick={() => setChatsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-[13px] font-semibold text-[#606060] hover:text-[#909090]"
            >
              Chats
              <motion.span
                animate={{ rotate: chatsOpen ? 0 : -90 }}
                transition={{ duration: 0.18 }}
                className="flex"
              >
                <IconChevronDown className="h-4 w-4" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {chatsOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex flex-col gap-0.5 pb-2">
                      {chats.map((chat) => {
                        const active = chat.id === activeChatId;
                        const menuOpen = menuChatId === chat.id;
                        const renaming = renamingId === chat.id;

                        return (
                          <div
                            key={chat.id}
                            className={`group relative flex items-center rounded-xl px-2.5 py-1.5 ${
                              active ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
                            }`}
                          >
                            {renaming ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename(chat.id);
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                onBlur={() => commitRename(chat.id)}
                                className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.01em] text-white outline-none"
                              />
                            ) : (
                              <button
                                onClick={() => onSelectChat(chat.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className={`block truncate text-[14px] tracking-[-0.01em] ${
                                  active ? "font-medium text-white" : "font-normal text-[#e0e0e0]"
                                }`}>
                                  {chat.title}
                                </span>
                              </button>
                            )}

                            {/* Three-dots trigger */}
                            {!renaming && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuChatId(menuOpen ? null : chat.id);
                                }}
                                className={`ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-opacity hover:text-text-secondary ${
                                  menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                }`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Dropdown */}
                            <AnimatePresence>
                              {menuOpen && (
                                <motion.div
                                  ref={menuRef}
                                  initial={{ opacity: 0, scale: 0.97, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.97, y: -4 }}
                                  transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
                                  style={{ transformOrigin: "top right" }}
                                  className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl bg-surface-raised p-1 shadow-xl ring-1 ring-white/[0.08]"
                                >
                                  <button
                                    onClick={() => {
                                      setRenamingId(chat.id);
                                      setRenameValue(chat.title);
                                      setMenuChatId(null);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] tracking-[-0.01em] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                                  >
                                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => {
                                      onDeleteChat(chat.id);
                                      setMenuChatId(null);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] tracking-[-0.01em] text-[#e05555] transition-colors hover:bg-white/[0.06] hover:text-[#e86666]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                    Delete
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

      </motion.aside>
  );
}
