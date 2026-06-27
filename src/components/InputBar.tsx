import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, File, FileText, Paperclip, Search, Square, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { api } from "../api/client";
import { saveConnection } from "../api/session";
import type { SkillInfo } from "../api/types";
import { pop } from "../motion";
import type { Model } from "../types";
import ModelSelector from "./ModelSelector";
import ModeToggle from "./ModeToggle";
import Tooltip from "./Tooltip";

const BUILTIN_COMMANDS = [{ name: "api", description: "Change API key" }] as const;

export interface AttachedFile {
  file: File;
  id: string;
  previewUrl?: string;
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    csv: "text/csv",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    py: "text/x-python",
    js: "text/javascript",
    ts: "text/typescript",
    jsx: "text/jsx",
    tsx: "text/tsx",
  };
  return map[ext] ?? "";
}

function isTextLike(name: string) {
  return /\.(txt|py|js|ts|jsx|tsx|json|md|html|css|csv|xml|yaml|yml|log|env|cfg|ini|toml|rs|go|java|c|cpp|h|hpp)$/i.test(
    name,
  );
}

interface InputBarProps {
  onSend: (text: string, files: AttachedFile[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  placeholder?: string;
  auto?: boolean;
  hasCustomPermissions?: boolean;
  mode?: "ask" | "auto" | "custom";
  onSetMode?: (mode: "ask" | "auto" | "custom") => void;
  onToggleMode?: () => void;
  models: Model[];
  selectedModel: Model;
  onSelectModel: (name: string) => void;
  connected: boolean;
  onOpenConnect: () => void;
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

function InputBar({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder,
  auto,
  hasCustomPermissions,
  mode,
  onSetMode,
  onToggleMode,
  models,
  selectedModel,
  onSelectModel,
  connected,
  onOpenConnect,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [caret, setCaret] = useState(0);
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs height adjustment only when text value changes
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
    const q = slash?.query.toLowerCase() ?? "";
    const matched = BUILTIN_COMMANDS.filter(
      (c) => !q || c.name.includes(q) || c.description.toLowerCase().includes(q),
    );
    if (!skills) return matched;
    const matchedSkills = !q
      ? skills
      : skills.filter(
          (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
        );
    return [...matched, ...matchedSkills];
  }, [skills, slash]);

  useLayoutEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resets selection when query changes; deps rule ignores the functional intent
  useEffect(() => {
    setActiveIndex(0);
  }, [slash?.query]);

  const scrollActiveIntoView = useCallback(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-skill-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    scrollActiveIntoView();
  }, [scrollActiveIntoView]);

  const pickerLockRef = useRef(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Reset picker lock whenever the user modifies the value
  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers reset on user input
  useEffect(() => {
    pickerLockRef.current = false;
  }, [value]);

  const pickerOpen = slash !== null && !pickerLockRef.current;

  // Close the command picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target)) return;
      if (textareaRef.current?.contains(target)) return;
      pickerLockRef.current = true;
      forceUpdate();
      const el = textareaRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
        setCaret(len);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const insertSkill = (name: string) => {
    if (!slash) return;
    const next = `${value.slice(0, slash.slashIndex)}/${name} ${value.slice(caret)}`;
    setValue(next);
    const newCaret = slash.slashIndex + 1 + name.length + 1;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  const handleApiCommand = async (key: string) => {
    try {
      await api.connect(key);
      saveConnection({ apiKey: key });
      const masked = key.length > 12 ? `${key.slice(0, 8)}…${key.slice(-4)}` : key;
      setFeedback(`API key updated: ${masked}`);
    } catch {
      setFeedback("Failed to connect with the new key");
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const submit = () => {
    if (streaming || disabled) return;
    const trimmed = value.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    const apiKey = trimmed.match(/^\/api\s+(.+)$/)?.[1];
    if (apiKey) {
      handleApiCommand(apiKey);
      setValue("");
      return;
    }

    onSend(trimmed, attachedFiles);
    // Do NOT revoke preview URLs here — the timeline needs them to render
    // the attached images. They will be revoked when the file is explicitly
    // removed (removeFile) or when the chat is switched/cleared.
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
        e.preventDefault();
        const el = textareaRef.current;
        if (el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
          setCaret(len);
        }
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

  const handleFilePick = async () => {
    try {
      const paths = await open({
        multiple: true,
        filters: [
          {
            name: "All supported",
            extensions: [
              "png",
              "jpg",
              "jpeg",
              "gif",
              "webp",
              "bmp",
              "svg",
              "txt",
              "py",
              "js",
              "ts",
              "jsx",
              "tsx",
              "json",
              "md",
              "html",
              "css",
              "csv",
              "xml",
              "yaml",
              "yml",
            ],
          },
        ],
      });
      if (!paths) return;

      const files: File[] = [];
      for (const path of paths) {
        try {
          const url = convertFileSrc(path);
          const res = await fetch(url);
          const blob = await res.blob();
          const name = path.split(/[\\/]/).pop() ?? "file";
          files.push(new globalThis.File([blob], name, { type: mimeFromPath(path) }));
        } catch {
          // skip unreadable files
        }
      }
      if (files.length > 0) addFiles(files);
    } catch {
      // Not inside Tauri — fall back to browser file input
      fileInputRef.current?.click();
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const f: AttachedFile = {
        file,
        id: `${file.name}-${Date.now()}-${i}`,
      };
      if (isImage(file)) {
        f.previewUrl = URL.createObjectURL(file);
      }
      newFiles.push(f);
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addFiles(files);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const fileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const canSend = (value.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  const closePicker = useCallback(() => {
    pickerLockRef.current = true;
    const el = textareaRef.current;
    if (!el) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
    setCaret(len);
  }, []);

  return (
    <div
      style={{ transform: "translateX(var(--chat-shift, 0px))" }}
      className="mx-auto w-full max-w-3xl"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.py,.js,.ts,.jsx,.tsx,.json,.md,.html,.css,.csv,.xml,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-drop container needs no explicit role */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 px-3 pt-3 pb-2 transition-colors ${
          dragOver ? "border-accent" : "border-line"
        }`}
        style={{
          background: "rgba(18, 18, 18, 0.55)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        }}
      >
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="group relative flex items-center gap-2 rounded-lg border border-line bg-fill-subtle pl-2 pr-2 py-1.5"
              >
                {f.previewUrl ? (
                  <img
                    src={f.previewUrl}
                    alt={f.file.name}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-fill-hover text-text-muted">
                    {isTextLike(f.file.name) ? (
                      <FileText className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <File className="h-5 w-5" strokeWidth={1.5} />
                    )}
                  </span>
                )}
                <div className="min-w-0">
                  <span className="block max-w-[120px] truncate text-ui leading-tight text-text-secondary">
                    {f.file.name}
                  </span>
                  <span className="text-meta text-text-muted">{fileSize(f.file.size)}</span>
                </div>
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={() => removeFile(f.id)}
                  className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:bg-fill-strong hover:text-text-primary group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-2 flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-ui text-text-secondary"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
              <span>{feedback}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
          placeholder={placeholder ?? "Message warden..."}
          className="max-h-[200px] w-full resize-none bg-transparent px-1 text-body tracking-[-0.01em] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-60"
        />

        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Tooltip content="Attach file" side="top">
              <button
                type="button"
                aria-label="Attach file"
                onClick={handleFilePick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </Tooltip>
            {(onSetMode !== undefined || onToggleMode !== undefined) && (
              <div className="ml-2">
                <ModeToggle
                  mode={mode ?? (auto ? "auto" : "ask")}
                  hasCustomPermissions={hasCustomPermissions}
                  disabled={streaming}
                  onSetMode={onSetMode ?? (() => onToggleMode?.())}
                  onOpen={closePicker}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {connected ? (
              <ModelSelector
                models={models}
                selected={selectedModel}
                onSelect={(m) => onSelectModel(m.id)}
              />
            ) : (
              <button
                type="button"
                onClick={onOpenConnect}
                className="rounded-full border border-line bg-fill-subtle px-3 py-1 text-meta font-medium text-text-secondary transition-colors hover:border-fill-strong hover:text-text-primary"
              >
                Connect a model
              </button>
            )}
            {streaming ? (
              <motion.button
                type="button"
                onClick={onStop}
                whileTap={{ scale: 0.9 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-colors duration-200 hover:bg-white/90"
                title="Stop"
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={submit}
                disabled={!canSend}
                whileTap={canSend ? { scale: 0.9 } : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
                  canSend
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-fill-hover text-text-muted"
                }`}
                title="Send"
                aria-label="Send"
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </motion.button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              ref={listRef}
              initial={pop.initial}
              animate={pop.animate}
              exit={pop.exit}
              transition={pop.transition}
              style={{ transformOrigin: "bottom left" }}
              className="accelerate-scale absolute bottom-full left-0 mb-2 flex max-h-72 w-72 flex-col overflow-hidden rounded-xl border-2 border-line bg-[#1a1a1a] p-1 shadow-2xl"
            >
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-meta uppercase tracking-wider text-text-muted">
                <Search className="h-3 w-3" strokeWidth={1.75} />
                <span>Commands</span>
                {slash?.query && (
                  <span className="ml-auto font-mono text-text-secondary">/{slash.query}</span>
                )}
              </div>
              <div
                className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
                style={{
                  maskImage: "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 94%, transparent 100%)",
                }}
              >
                {filtered.map((item, idx) => {
                  const isBuiltin = idx < BUILTIN_COMMANDS.length;
                  const active = idx === activeIndex;
                  return (
                    <div key={isBuiltin ? `builtin-${item.name}` : (item as SkillInfo).name}>
                      <button
                        type="button"
                        data-skill-index={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertSkill(item.name);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors ${
                          active ? "bg-fill-active" : "hover:bg-fill-hover"
                        }`}
                      >
                        <span
                          className={`truncate text-ui tracking-[-0.01em] ${
                            active ? "text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          /{item.name}
                        </span>
                        {isBuiltin && (
                          <span className="ml-auto truncate text-meta text-text-muted">
                            {(item as (typeof BUILTIN_COMMANDS)[number]).description}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
                {skills === null && filtered.length === BUILTIN_COMMANDS.length && (
                  <div className="px-2.5 py-2 text-ui text-text-muted">Loading…</div>
                )}
                {skills !== null && filtered.length === 0 && (
                  <div className="px-2.5 py-2 text-ui text-text-muted">No commands match.</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default memo(InputBar);
