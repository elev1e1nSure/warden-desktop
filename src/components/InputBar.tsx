import { motion } from "framer-motion";
import { ArrowUp, AtSign, Paperclip, Square, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    if (streaming || disabled) return;
    const trimmed = value.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(trimmed, attachedFiles);
    setValue("");
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      newFiles.push({
        file: files[i],
        id: `${files[i].name}-${Date.now()}-${i}`,
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

      <div className="rounded-2xl border-2 border-white/[0.1] bg-white/[0.04] px-3 pt-3 pb-2 backdrop-blur-2xl">
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
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={placeholder ?? "Message warden..."}
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
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-secondary">
                <AtSign className="h-[16px] w-[16px]" strokeWidth={2.5} />
              </button>
            </Tooltip>
            {onToggleMode !== undefined && (
              <div className="ml-2">
              <ModeToggle
                auto={Boolean(auto)}
                disabled={streaming}
                onToggle={onToggleMode}
              />
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
      </div>
    </div>
  );
}
