import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MoreHorizontal, Plug } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Chat } from "../types";
import AnimatedBlocks from "./AnimatedBlocks";
import AnimatedSquarePen from "./AnimatedSquarePen";
import AnimatedSettings from "./AnimatedSettings";
import AnimatedTrash from "./AnimatedTrash";
import AnimatedPencil from "./AnimatedPencil";

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
  onOpenSettings?: () => void;
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}

function NavButton({ icon, label, onClick, disabled, active }: NavButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none ${
        disabled
          ? "cursor-default text-text-faint"
          : active
            ? "bg-fill-active text-text-primary"
            : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, { isHovered: hovered || active } as any)
          : icon}
      </span>
      <span className="truncate text-ui-lg font-medium tracking-[-0.01em] whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

interface DropdownButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function DropdownButton({ icon, label, onClick, danger }: DropdownButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fill-hover ${
        danger
          ? "text-danger hover:text-danger-hover"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, { isHovered: hovered } as any)
          : icon}
      </span>
      <span className="flex-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors">
        {label}
      </span>
    </button>
  );
}

function Sidebar({
  chats,
  activeChatId,
  width,
  skillsActive,
  onSelectChat,
  onNewChat,
  onOpenSkills,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
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
      setMenuPos({ top: rect.top - 4, left: rect.right });
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
      style={{ width, backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)" }}
      className="relative flex h-full min-h-0 shrink-0 flex-col bg-sidebar border-r border-white/[0.08]"
    >
      {/* Primary nav */}
      <nav className="flex flex-col gap-px overflow-hidden px-2 pt-2">
        <NavButton
          icon={<AnimatedSquarePen strokeWidth={1.75} />}
          label="New Chat"
          onClick={onNewChat}
        />
        <NavButton
          icon={<AnimatedBlocks strokeWidth={1.75} />}
          label="Skills"
          active={skillsActive}
          onClick={onOpenSkills}
        />
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
                initial={{ maxHeight: 0, opacity: 0 }}
                animate={{ maxHeight: 800, opacity: 1 }}
                exit={{ maxHeight: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{
                  maskImage: "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
                }}
              >
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !renaming) onSelectChat(chat.id);
                        }}
                        className="group relative flex min-w-0 cursor-pointer items-center rounded-xl px-2.5 py-1.5 hover:bg-fill-hover"
                        style={{ isolation: "isolate" }}
                      >
                        {active && (
                          <motion.div
                            layoutId="active-chat-highlight"
                            className="absolute inset-0 rounded-xl bg-fill-active -z-10"
                            transition={{ type: "spring", stiffness: 600, damping: 48 }}
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
                          <button type="button" className="relative z-10 min-w-0 flex-1 text-left">
                            <span
                              className={`block truncate text-ui-lg tracking-[-0.01em] ${
                                active
                                  ? "font-medium text-text-primary"
                                  : "font-normal text-text-secondary"
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Settings pinned to bottom */}
      <div className="px-2 pb-2">
        <NavButton
          icon={<AnimatedSettings strokeWidth={1.75} />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>

      {createPortal(
        <AnimatePresence>
          {menuChatId && menuPos
            ? (() => {
                const chat = chats.find((c) => c.id === menuChatId);
                if (!chat) return null;
                return (
                  <div
                    style={{
                      position: "fixed",
                      top: menuPos.top,
                      left: menuPos.left,
                      transform: "translate(-100%, -100%)",
                      zIndex: 9999,
                    }}
                  >
                    <motion.div
                      ref={menuRef}
                      initial={{ opacity: 0, scale: 0.96, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 6 }}
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        transformOrigin: "bottom right",
                      }}
                      className="accelerate-scale w-36 overflow-hidden rounded-xl border-2 border-line bg-[#1a1a1a] p-1 shadow-2xl flex flex-col gap-0.5"
                    >
                      <DropdownButton
                        icon={
                          <AnimatedPencil
                            className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover:text-text-secondary"
                            strokeWidth={2.25}
                          />
                        }
                        label="Rename"
                        onClick={() => {
                          setRenamingId(chat.id);
                          setRenameValue(chat.title);
                          setMenuChatId(null);
                        }}
                      />
                      <DropdownButton
                        icon={
                          <AnimatedTrash
                            className="h-3.5 w-3.5 shrink-0 text-danger opacity-70 group-hover:opacity-100"
                            strokeWidth={2.25}
                          />
                        }
                        label="Delete"
                        danger
                        onClick={() => {
                          onDeleteChat(chat.id);
                          setMenuChatId(null);
                        }}
                      />
                    </motion.div>
                  </div>
                );
              })()
            : null}
        </AnimatePresence>,
        document.body,
      )}
    </aside>
  );
}

export default memo(Sidebar);
