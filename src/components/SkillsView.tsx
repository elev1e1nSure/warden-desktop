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
import { api } from "../api/client";
import type { SkillInfo } from "../api/types";
import { HIGHLIGHT_SPRING, pop, skillDetail } from "../motion";

type LoadState = "idle" | "loading" | "ok" | "error";
type RightPanel = "detail" | "create" | "edit";

export default function SkillsView({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
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
    let cancelled = false;
    if (!cancelled) loadSkills();
    return () => {
      cancelled = true;
    };
  }, [loadSkills]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Left panel — same bg as sidebar */}
        <div className="flex w-64 shrink-0 flex-col bg-sidebar">
          {/* Search */}
          <div className="flex items-center gap-1 px-2 py-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-secondary"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-secondary"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>

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
                      onClick={() => {
                        setSelectedName(skill.name);
                        setRightPanel("detail");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelectedName(skill.name);
                          setRightPanel("detail");
                        }
                      }}
                      className={`group relative flex min-w-0 cursor-pointer items-center rounded-xl px-2.5 py-1.5 ${
                        active ? "" : "hover:bg-fill-hover"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="skill-active"
                          transition={HIGHLIGHT_SPRING}
                          className="absolute inset-0 rounded-xl bg-fill-active"
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

        {/* Right panel — content area */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {rightPanel === "create" ? (
              <SkillForm
                key="create"
                onSaved={() => {
                  setRightPanel("detail");
                  loadSkills();
                }}
                onCancel={() => setRightPanel("detail")}
              />
            ) : rightPanel === "edit" && editingName ? (
              (() => {
                const s = skills.find((x) => x.name === editingName);
                return (
                  <SkillForm
                    key={editingName}
                    existing={s ?? undefined}
                    onSaved={() => {
                      setRightPanel("detail");
                      setEditingName(null);
                      loadSkills();
                    }}
                    onCancel={() => {
                      setRightPanel("detail");
                      setEditingName(null);
                    }}
                    onDelete={() => {
                      setRightPanel("detail");
                      setEditingName(null);
                      if (editingName === selectedName) setSelectedName(null);
                      void handleDelete(editingName);
                    }}
                  />
                );
              })()
            ) : selected ? (
              <motion.div
                key={selected.name}
                initial={skillDetail.initial}
                animate={skillDetail.animate}
                exit={skillDetail.exit}
                transition={skillDetail.transition}
                className="px-8 py-7"
              >
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-title font-semibold tracking-[-0.02em] text-text-primary">
                    {selected.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleEdit(selected.name)}
                    className="flex items-center gap-1.5 rounded-lg bg-fill-hover px-3 py-1.5 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Edit
                  </button>
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
                  <pre className="mt-6 whitespace-pre-wrap break-words rounded-xl bg-code-bg px-4 py-4 font-mono text-ui leading-relaxed text-code-text">
                    {selected.content}
                  </pre>
                )}
              </motion.div>
            ) : loadState === "ok" && skills.length > 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-full flex-col items-center justify-center gap-3"
              >
                <Sparkles className="h-10 w-10 text-text-muted" strokeWidth={1.5} />
                <p className="text-title font-semibold tracking-[-0.02em] text-text-muted">
                  Select a skill
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {menuSkillName && menuPos ? (
            <motion.div
              ref={menuRef}
              initial={pop.initial}
              animate={pop.animate}
              exit={pop.exit}
              transition={pop.transition}
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                transform: "translateX(-100%)",
                transformOrigin: "top right",
                zIndex: 9999,
              }}
              className="w-36 overflow-hidden rounded-xl bg-surface-raised p-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => handleEdit(menuSkillName)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-ui tracking-[-0.01em] text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(menuSkillName)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-ui tracking-[-0.01em] text-danger transition-colors hover:bg-fill-hover hover:text-danger-hover"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                Delete
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
    <motion.div
      key={isCreate ? "create" : existing.name}
      initial={skillDetail.initial}
      animate={skillDetail.animate}
      exit={skillDetail.exit}
      transition={skillDetail.transition}
      className="px-8 py-7"
    >
      <div className="flex items-center gap-2">
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
    </motion.div>
  );
}
