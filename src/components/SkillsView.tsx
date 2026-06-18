import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import type { SkillInfo } from "../api/types";

type LoadState = "idle" | "loading" | "ok" | "error";
type RightPanel = "detail" | "create" | "edit";

const skillsMdComponents = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="mt-2 mb-1.5 text-[15px] leading-[1.8] text-text-secondary" />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      {...props}
      className="mb-3 mt-6 text-[24px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="mb-2.5 mt-5 text-[20px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className="mb-2 mt-4 text-[17px] font-semibold tracking-[-0.015em] text-text-primary"
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      {...props}
      className="mb-1.5 mt-3.5 text-body font-semibold tracking-[-0.01em] text-text-primary"
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="my-2 list-disc space-y-1.5 pl-6 marker:text-text-muted" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="my-2 list-decimal space-y-1.5 pl-6 marker:text-text-muted" />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="text-[15px] leading-[1.75] text-text-secondary" />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[#7ab2ff] underline decoration-[#7ab2ff]/40 underline-offset-2 hover:decoration-[#7ab2ff]"
    />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="my-3 border-l-2 border-line pl-4 italic text-text-secondary"
    />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="my-4 border-line" />
  ),
  code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const { className, children, inline, ...rest } = props;
    if (inline) {
      return (
        <code
          {...rest}
          className="rounded bg-fill-subtle px-[5px] py-[1px] font-mono text-[13px] text-code-text"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...rest} className={`${className ?? ""} font-mono text-[13px]`}>
        {children}
      </code>
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-3 overflow-x-auto rounded-xl bg-fill-subtle p-4 text-[13px] leading-[1.6] text-code-text ring-1 ring-hairline"
    />
  ),
};

export default function SkillsView({
  onClose,
  ready,
  sidebarWidth,
  setSidebarWidth,
}: {
  onClose: () => void;
  ready: boolean;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("detail");
  const [editingName, setEditingName] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuSkillName, setMenuSkillName] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const loadSkills = useCallback(() => {
    setLoadState("loading");
    api
      .skills()
      .then((res) => {
        setSkills(res.skills ?? []);
        setLoadState("ok");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (!cancelled) loadSkills();
    return () => {
      cancelled = true;
    };
  }, [ready, loadSkills]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return skills;
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [skills, query]);

  const selected = skills.find((s) => s.name === selectedName) ?? null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!menuSkillName) {
      setMenuPos(null);
      return;
    }
    const trigger = menuTriggerRef.current[menuSkillName];
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setMenuSkillName(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuSkillName]);

  const handleCreate = () => {
    setSelectedName(null);
    setEditingName(null);
    setRightPanel("create");
  };

  const handleEdit = (name: string) => {
    setSelectedName(name);
    setEditingName(name);
    setRightPanel("edit");
    setMenuSkillName(null);
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteSkill(name);
      setMenuSkillName(null);
      if (name === selectedName) {
        setSelectedName(null);
        setRightPanel("detail");
      }
      loadSkills();
    } catch {
      /* ignore */
    }
  };
  const goBackToDetail = useCallback(() => {
    setEditingName(null);
    setRightPanel("detail");
  }, []);

  const selectSkill = useCallback(
    (name: string) => {
      if (name === selectedName) return;
      setSelectedName(name);
      setRightPanel("detail");
    },
    [selectedName],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Left panel — same bg as sidebar */}
        <div
          style={{ width: sidebarWidth }}
          className="flex shrink-0 flex-col bg-sidebar border-r border-white/[0.08]"
        >
          <nav className="flex flex-col px-2 pt-2">
            {/* Back — full nav item, same as Settings */}
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-text-secondary transition-none hover:bg-fill-hover hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="text-ui-lg font-medium tracking-[-0.01em]">Back</span>
            </button>

            <div className="h-3" />

            {/* Search + New */}
            <div className="flex items-center gap-1 pb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-xl bg-fill-hover py-1.5 pl-8 pr-3 text-ui text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-none hover:bg-fill-hover hover:text-text-secondary"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </nav>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-2 pb-3">
            {loadState === "loading" && (
              <p className="px-2 py-2 text-ui text-text-muted">Loading…</p>
            )}
            {loadState === "error" && (
              <p className="px-2 py-2 text-ui text-danger">Failed to load.</p>
            )}
            {loadState === "ok" && filtered.length === 0 && (
              <p className="px-2 py-2 text-ui text-text-muted">
                {query ? "No matches." : "No skills installed."}
              </p>
            )}
            {loadState === "ok" && (
              <div className="flex flex-col gap-0.5">
                {filtered.map((skill) => {
                  const active = skill.name === selectedName;
                  const menuOpen = menuSkillName === skill.name;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: div[role="button"] needed for nested button children
                    <div
                      key={skill.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectSkill(skill.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") selectSkill(skill.name);
                      }}
                      className="group relative flex min-w-0 cursor-pointer items-center rounded-xl px-2.5 py-1.5 hover:bg-fill-hover"
                      style={{ isolation: "isolate" }}
                    >
                      {active && (
                        <motion.div
                          layoutId="active-skills-highlight"
                          className="absolute inset-0 rounded-xl bg-fill-active -z-10"
                          transition={{ type: "spring", stiffness: 600, damping: 48 }}
                        />
                      )}
                      <span
                        className={`relative z-10 block flex-1 truncate text-ui-lg tracking-[-0.01em] ${
                          active ? "font-medium text-text-primary" : "text-text-secondary"
                        }`}
                      >
                        {skill.name}
                      </span>
                      <button
                        type="button"
                        aria-label="Skill options"
                        ref={(el) => {
                          menuTriggerRef.current[skill.name] = el;
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuSkillName(menuOpen ? null : skill.name);
                        }}
                        className={`relative z-10 ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-opacity hover:text-text-secondary ${
                          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resize handle */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only drag handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (ev: MouseEvent) =>
              setSidebarWidth(Math.min(400, Math.max(180, startW + ev.clientX - startX)));
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          className="relative z-10 w-0 shrink-0 cursor-col-resize"
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </div>

        {/* Right panel — content area */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          {rightPanel === "create" ? (
            <SkillForm
              key="create"
              onSaved={() => {
                goBackToDetail();
                loadSkills();
              }}
              onCancel={goBackToDetail}
            />
          ) : rightPanel === "edit" && editingName ? (
            (() => {
              const s = skills.find((x) => x.name === editingName);
              return (
                <SkillForm
                  key={editingName}
                  existing={s ?? undefined}
                  onSaved={() => {
                    goBackToDetail();
                    loadSkills();
                  }}
                  onCancel={goBackToDetail}
                  onDelete={() => {
                    goBackToDetail();
                    if (editingName === selectedName) setSelectedName(null);
                    void handleDelete(editingName);
                  }}
                />
              );
            })()
          ) : selected ? (
            <div key={selected.name} className="px-8 py-8">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-2xl font-semibold tracking-[-0.03em] text-text-primary">
                  {selected.name}
                </h2>
              </div>
              {selected.description && (
                <p className="mt-2 text-ui-lg leading-relaxed text-text-secondary">
                  {selected.description}
                </p>
              )}
              {selected.location && (
                <p className="mt-3 text-meta text-text-muted">{selected.location}</p>
              )}
              {selected.content && (
                <div className="mt-6 markdown-body">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={skillsMdComponents}
                  >
                    {selected.content}
                  </Markdown>
                </div>
              )}
            </div>
          ) : loadState === "ok" && skills.length > 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Sparkles className="h-10 w-10 text-text-muted" strokeWidth={1.5} />
              <p className="text-title font-semibold tracking-[-0.02em] text-text-muted">
                Select a skill
              </p>
            </div>
          ) : loadState === "loading" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-ui-lg text-text-muted">Loading…</p>
            </div>
          ) : null}
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {menuSkillName && menuPos ? (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                transform: "translateX(-100%)",
                transformOrigin: "top right",
                zIndex: 9999,
              }}
              className="accelerate-scale w-36 overflow-hidden rounded-xl border-2 border-line bg-[#1a1a1a] p-1 shadow-2xl flex flex-col gap-0.5"
            >
              <button
                type="button"
                onClick={() => handleEdit(menuSkillName)}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fill-hover text-text-secondary hover:text-text-primary"
              >
                <Pencil
                  className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover:text-text-secondary"
                  strokeWidth={1.75}
                />
                <span className="flex-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors">
                  Edit
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(menuSkillName)}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fill-hover text-danger hover:text-danger-hover"
              >
                <Trash2
                  className="h-3.5 w-3.5 shrink-0 text-danger opacity-70 group-hover:opacity-100"
                  strokeWidth={1.75}
                />
                <span className="flex-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors">
                  Delete
                </span>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function SkillForm({
  existing,
  onSaved,
  onCancel,
  onDelete,
}: {
  existing?: SkillInfo;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isCreate = !existing;

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName || !trimmedDesc || !content.trim()) {
      setError("Name, description and content are required.");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmedName)) {
      setError("Name must be lowercase letters, digits, and hyphens (e.g. my-skill).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isCreate) {
        await api.createSkill(trimmedName, trimmedDesc, content);
      } else {
        await api.updateSkill(existing.name, trimmedDesc, content);
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-8 py-7">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-secondary"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <h2 className="flex-1 text-title font-semibold tracking-[-0.02em] text-text-primary">
          {isCreate ? "New Skill" : `Edit ${existing.name}`}
        </h2>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label
            htmlFor="skill-name"
            className="block text-ui font-medium text-text-secondary mb-1"
          >
            Name
          </label>
          <input
            id="skill-name"
            value={name}
            disabled={!isCreate}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-skill"
            className={`w-full rounded-xl border-2 border-line bg-fill-subtle px-3 py-2 text-ui text-text-primary placeholder:text-text-muted outline-none ${
              !isCreate ? "text-text-muted cursor-not-allowed" : ""
            }`}
          />
        </div>

        <div>
          <label
            htmlFor="skill-desc"
            className="block text-ui font-medium text-text-secondary mb-1"
          >
            Description
          </label>
          <input
            id="skill-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this skill does…"
            className="w-full rounded-xl border-2 border-line bg-fill-subtle px-3 py-2 text-ui text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="skill-content"
            className="block text-ui font-medium text-text-secondary mb-1"
          >
            Content
          </label>
          <textarea
            id="skill-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="SKILL.md body…"
            rows={14}
            className="w-full resize-none rounded-xl border-2 border-line bg-fill-subtle px-3 py-2 font-mono text-ui leading-relaxed text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>

        {error && <p className="text-ui text-danger">{error}</p>}

        <div className="flex items-center justify-between">
          <div>
            {!isCreate && onDelete && (
              <AnimatePresence mode="wait">
                {showDeleteConfirm ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-ui-lg font-medium text-text-primary">
                      Delete {existing?.name}?
                    </span>
                    <motion.button
                      type="button"
                      onClick={() => {
                        onDelete?.();
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.14, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-lg px-3 py-1.5 text-ui font-medium text-danger transition-colors hover:bg-fill-hover"
                    >
                      Yes
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.14, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-lg px-3 py-1.5 text-ui text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
                    >
                      No
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="delete-btn"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ui font-medium text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ui font-medium text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-fill-hover px-3 py-1.5 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
