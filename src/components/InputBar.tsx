import { motion } from "framer-motion";
import { ArrowUp, AtSign, Paperclip, Search, Square, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { SkillInfo } from "../api/types";
import ModeToggle from "./ModeToggle";
import Tooltip from "./Tooltip";

export interface AttachedFile {
  file: File;
  id: string;
}

interface InputBarProps {
  onSend: (text: string, files: AttachedFile[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  placeholder?: string;
  auto?: boolean;
  onToggleMode?: () => void;
}

/* Find a `/`-prefixed token the user is currently editing. We only treat
   `/` as a slash command when it's at the start of the line or right after
   a whitespace — otherwise it's just part of a normal word. Returns the
   query string (without the leading slash) and the absolute index of the
   slash, or null if no command is active. */
function detectSlashToken(
  value: string,
  caret: number,
): { query: string; slashIndex: number } | null {
  if (caret < 1) return null;
  // Walk back from the caret to either whitespace/start or the `/`.
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === undefined) break;
    if (ch === "/") {
      const prev = i === 0 ? " " : value[i - 1];
      if (prev === " " || prev === "\n" || prev === "\t" || prev === undefined) {
        return { query: value.slice(i + 1, caret), slashIndex: i };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

export default function InputBar({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder,
  auto,
  onToggleMode,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [caret, setCaret] = useState(0);
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const slash = useMemo(() => detectSlashToken(value, caret), [value, caret]);

  // Lazily load the skill list the first time the picker opens.
  useEffect(() => {
    if (!slash || skills !== null) return;
    let cancelled = false;
    api
      .skills()
      .then((res) => {
        if (!cancelled) setSkills(res.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slash, skills]);

  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = slash?.query.toLowerCase() ?? "";
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [skills, slash]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slash?.query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-skill-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const pickerOpen = slash !== null;

  const insertSkill = (name: string) => {
    if (!slash) return;
    const next =
      value.slice(0, slash.slashIndex) +
      "/" +
      name +
      " " +
      value.slice(caret);
    setValue(next);
    const newCaret = slash.slashIndex + 1 + name.length + 1;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  const submit = () => {
    if (streaming || disabled) return;
    const trimmed = value.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(trimmed, attachedFiles);
    setValue("");
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length > 0) {
          setActiveIndex((i) => (i + 1) % filtered.length);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length > 0) {
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        }
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const picked = filtered[activeIndex];
        if (picked) {
          e.preventDefault();
          insertSkill(picked.name);
          return;
        }
      }
      if (e.key === "Escape") {
        // Close the picker by jumping the caret to the start of the line
        // so the slash token is no longer "active". Easiest way without
        // extra state: append a space and remove it via undo, but that
        // changes the value. Simpler: just blur or let default happen.
        // We keep Esc as a no-op so the user can still type `/`.
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    setCaret(t.selectionStart ?? t.value.length);
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      newFiles.push({
        file,
        id: `${file.name}-${Date.now()}-${i}`,
      });
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const fileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const canSend = (value.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  const handleMention = () => {
    const el = textareaRef.current;
    if (!el) {
      setValue((v) => v + "/");
      return;
    }
    const pos = el.selectionStart ?? value.length;
    // Add a leading space if the caret isn't at a word boundary so the
    // slash command is recognised by detectSlashToken.
    const needsSpace = pos > 0 && !/\s/.test(value[pos - 1] ?? "");
    const insert = (needsSpace ? " /" : "/");
    const next = value.slice(0, pos) + insert + value.slice(pos);
    setValue(next);
    const newCaret = pos + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
      setCaret(newCaret);
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.py,.js,.ts,.jsx,.tsx,.json,.md,.html,.css,.csv,.xml,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative rounded-2xl border-2 border-white/[0.1] bg-white/[0.04] px-3 pt-3 pb-2 backdrop-blur-2xl">
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-text-secondary"
              >
                <span className="max-w-[120px] truncate">{f.file.name}</span>
                <span className="text-text-muted">({fileSize(f.file.size)})</span>
                <button
                  onClick={() => removeFile(f.id)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded hover:bg-white/[0.1] hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          rows={1}
          disabled={disabled}
          placeholder={placeholder ?? "Message warden... — type / for skills"}
          className="max-h-[200px] w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed tracking-[-0.01em] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-60"
        />

        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Tooltip content="Attach file" side="top">
              <button
                onClick={handleFilePick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-secondary"
              >
                <Paperclip className="h-[16px] w-[16px]" strokeWidth={2.5} />
              </button>
            </Tooltip>
            <Tooltip content="Mention" side="top">
              <button onClick={handleMention} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-secondary">
                <AtSign className="h-[16px] w-[16px]" strokeWidth={2.5} />
              </button>
            </Tooltip>
            {onToggleMode !== undefined && (
              <div className="ml-2">
                <ModeToggle auto={Boolean(auto)} disabled={streaming} onToggle={onToggleMode} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {streaming ? (
              <motion.button
                onClick={onStop}
                whileTap={{ scale: 0.9 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-colors duration-200 hover:bg-white/90"
                title="Stop"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                onClick={submit}
                disabled={!canSend}
                whileTap={canSend ? { scale: 0.9 } : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
                  canSend
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/[0.06] text-text-muted"
                }`}
                title="Send"
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </motion.button>
            )}
          </div>
        </div>

        {pickerOpen && (
          <div
            ref={listRef}
            className="absolute bottom-full left-0 mb-2 max-h-72 w-80 overflow-y-auto rounded-xl border border-white/[0.08] bg-surface-raised p-1 shadow-2xl"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-text-muted">
              <Search className="h-3 w-3" />
              <span>Skills</span>
              {slash && slash.query && (
                <span className="ml-auto font-mono text-text-secondary">
                  /{slash.query}
                </span>
              )}
            </div>
            {skills === null && (
              <div className="px-2.5 py-2 text-[13px] text-text-muted">Loading…</div>
            )}
            {skills !== null && filtered.length === 0 && (
              <div className="px-2.5 py-2 text-[13px] text-text-muted">
                No skills match.
              </div>
            )}
            {filtered.map((skill, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={skill.name}
                  data-skill-index={idx}
                  onMouseDown={(e) => {
                    // mousedown so the textarea doesn't lose focus first
                    e.preventDefault();
                    insertSkill(skill.name);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left ${
                    active ? "bg-white/[0.09]" : ""
                  }`}
                >
                  <span
                    className={`text-[13.5px] tracking-[-0.01em] ${
                      active ? "text-white" : "text-[#e0e0e0]"
                    }`}
                  >
                    /{skill.name}
                  </span>
                  {skill.description && (
                    <span className="line-clamp-2 text-[11.5px] leading-snug text-text-muted">
                      {skill.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
