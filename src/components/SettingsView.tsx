import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Brain,
  Check,
  Eye,
  EyeOff,
  Info,
  Loader2,
  SlidersHorizontal,
  Trash2,
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { loadConnection, saveConnection } from "../api/session";
import type { MemoryState, StatusResult } from "../api/types";
import { skillDetailDown } from "../motion";
import type { Model } from "../types";
import ModelSelector from "./ModelSelector";

export type SettingsSection = "general" | "connection" | "agent" | "memory" | "about";

interface SettingsViewProps {
  onClose: () => void;
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
  onToggleMode: () => void;
  onOpenSkills: () => void;
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <SlidersHorizontal strokeWidth={1.75} /> },
  { id: "connection", label: "Provider", icon: <Wifi strokeWidth={1.75} /> },
  { id: "agent", label: "Agent", icon: <Bot strokeWidth={1.75} /> },
  { id: "memory", label: "Memory", icon: <Brain strokeWidth={1.75} /> },
  { id: "about", label: "About", icon: <Info strokeWidth={1.75} /> },
];

export default function SettingsView({
  onClose,
  status,
  connected,
  models,
  onSelectModel,
  onToggleMode,
  onOpenSkills,
}: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>("general");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Left panel — section nav */}
        <div className="flex w-[260px] shrink-0 flex-col bg-sidebar">
          <div className="flex items-center gap-1 px-2 py-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-secondary"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <span className="text-ui-lg font-semibold tracking-[-0.01em] text-text-primary">
              Settings
            </span>
          </div>

          <nav className="flex flex-col gap-0.5 px-2 pt-1">
            {SECTIONS.map((s) => {
              const active = s.id === section;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none ${
                    active
                      ? "bg-fill-active text-text-primary"
                      : "text-text-secondary hover:bg-fill-hover hover:text-text-primary"
                  }`}
                >
                  <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{s.icon}</span>
                  <span className="truncate text-ui-lg font-medium tracking-[-0.01em]">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right panel — content */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <motion.div key={section} {...skillDetailDown} className="mx-auto max-w-2xl px-8 py-7">
            {section === "general" && <GeneralSection status={status} />}
            {section === "connection" && (
              <ConnectionSection
                status={status}
                connected={connected}
                models={models}
                onSelectModel={onSelectModel}
              />
            )}
            {section === "agent" && <AgentSection status={status} onToggleMode={onToggleMode} />}
            {section === "memory" && <MemorySection />}
            {section === "about" && (
              <AboutSection status={status} connected={connected} onOpenSkills={onOpenSkills} />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-title font-semibold tracking-[-0.02em] text-text-primary">{title}</h2>
      {hint && <p className="mt-1 text-ui-lg text-text-muted">{hint}</p>}
    </div>
  );
}

/** A labelled settings row: title + optional description on the left, control on the right. */
function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-hairline py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-ui-lg font-medium tracking-[-0.01em] text-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-ui text-text-muted">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-text-faint"}`}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500/80" : "bg-fill-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function GeneralSection({ status }: { status: StatusResult | null }) {
  return (
    <>
      <SectionHeader title="General" hint="Workspace and appearance." />
      <p className="text-ui-lg text-text-muted">cwd: {status?.cwd ?? "—"}</p>
    </>
  );
}

function ConnectionSection({
  status,
  connected,
  models,
  onSelectModel,
}: {
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    const saved = loadConnection();
    if (saved?.apiKey) setApiKey(saved.apiKey);
  }, []);

  const connect = async () => {
    const key = apiKey.trim();
    if (!key) {
      setError("API key is required");
      return;
    }
    setBusy(true);
    setError("");
    setSavedOk(false);
    try {
      const res = await api.connect(key);
      if (res.ok) {
        saveConnection({ apiKey: key });
        setSavedOk(true);
      } else {
        setError(res.error || "connection failed");
      }
    } catch (e) {
      setError(`could not reach backend: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const modelList: Model[] = models.map((m) => ({ id: m, name: m, description: "" }));
  const selectedModel: Model = {
    id: status?.model ?? "",
    name: status?.model || "No model",
    description: "",
  };

  return (
    <>
      <SectionHeader title="Provider" hint="OpenRouter connection and default model." />

      <Field
        label="Status"
        description={connected ? "Backend is connected to the provider." : "Not connected."}
      >
        <span className="flex items-center gap-2 text-ui text-text-secondary">
          <StatusDot ok={connected} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </Field>

      <Field label="Provider">
        <span className="text-ui text-text-secondary">{status?.provider || "—"}</span>
      </Field>

      <Field label="Default model" description="Used for new chats. Mirrors the status bar.">
        {connected ? (
          <ModelSelector
            models={modelList}
            selected={selectedModel}
            onSelect={(m) => onSelectModel(m.id)}
          />
        ) : (
          <span className="text-ui text-text-muted">—</span>
        )}
      </Field>

      <div className="mt-6">
        <label htmlFor="settings-api-key" className="block text-ui font-medium text-text-secondary">
          API key
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="settings-api-key"
              type={reveal ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setSavedOk(false);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="sk-or-v1-…"
              className="w-full rounded-xl border-2 border-line bg-fill-subtle py-2 pl-3 pr-10 text-ui text-text-primary placeholder:text-text-muted outline-none focus:border-fill-strong"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide API key" : "Show API key"}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-secondary"
            >
              {reveal ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-fill-hover px-4 py-2 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Connecting…" : connected ? "Reconnect" : "Connect"}
          </button>
        </div>
        {error && <p className="mt-2 text-ui text-danger">{error}</p>}
        {savedOk && !error && (
          <p className="mt-2 flex items-center gap-1.5 text-ui text-emerald-400">
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            Connected and saved.
          </p>
        )}
      </div>
    </>
  );
}

function AgentSection({
  status,
  onToggleMode,
}: {
  status: StatusResult | null;
  onToggleMode: () => void;
}) {
  const [compacting, setCompacting] = useState(false);
  const [compactMsg, setCompactMsg] = useState("");
  const auto = status?.mode === "auto";
  const used = status?.token_count ?? 0;
  const limit = status?.token_limit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const compact = async () => {
    setCompacting(true);
    setCompactMsg("");
    try {
      const res = await api.compact();
      setCompactMsg(
        `Context compacted: ${res.tokens_before.toLocaleString()} → ${res.tokens_after.toLocaleString()} tokens.`,
      );
    } catch {
      setCompactMsg("Compact failed.");
    } finally {
      setCompacting(false);
    }
  };

  return (
    <>
      <SectionHeader title="Agent" hint="Execution behavior and context window." />

      <Field
        label="Auto mode"
        description="Run tools without asking for confirmation. Off = ask before risky actions."
      >
        <Toggle checked={auto} onChange={onToggleMode} label="Toggle auto mode" />
      </Field>

      <Field
        label="Context usage"
        description={
          limit > 0 ? `${used.toLocaleString()} / ${limit.toLocaleString()} tokens` : "—"
        }
      >
        <span className="text-ui tabular-nums text-text-secondary">{pct}%</span>
      </Field>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-ui-lg font-medium tracking-[-0.01em] text-text-primary">
              Compact context
            </p>
            <p className="mt-0.5 text-ui text-text-muted">
              Summarize the conversation to free up the context window.
            </p>
          </div>
          <button
            type="button"
            onClick={compact}
            disabled={compacting}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-fill-hover px-4 py-2 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active disabled:opacity-40"
          >
            {compacting && <Loader2 className="h-4 w-4 animate-spin" />}
            {compacting ? "Compacting…" : "Compact"}
          </button>
        </div>
        {compactMsg && <p className="mt-2 text-ui text-text-muted">{compactMsg}</p>}
      </div>
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MemorySection() {
  const [state, setState] = useState<MemoryState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);

  const load = () => {
    api
      .memoryState()
      .then(setState)
      .catch(() => setState(null));
  };

  useEffect(load, []);

  const toggle = async () => {
    if (!state || busy) return;
    const next = !state.enabled;
    setBusy(true);
    setState({ ...state, enabled: next });
    try {
      await api.setMemory(next);
    } catch {
      setState({ ...state, enabled: !next });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await api.clearMemory();
      setConfirmClear(false);
      setSnapshot(null);
      load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const viewSnapshot = async () => {
    setSnapLoading(true);
    try {
      const snap = await api.memorySnapshot();
      setSnapshot(JSON.stringify(snap, null, 2));
    } catch {
      setSnapshot("Failed to load snapshot.");
    } finally {
      setSnapLoading(false);
    }
  };

  return (
    <>
      <SectionHeader title="Memory" hint="Long-term memory the agent keeps across chats." />

      <Field
        label="Enable memory"
        description="Let the agent remember facts and recall them in future chats."
      >
        <Toggle
          checked={Boolean(state?.enabled)}
          onChange={toggle}
          label="Toggle long-term memory"
        />
      </Field>

      <Field label="Stored entries">
        <span className="text-ui tabular-nums text-text-secondary">{state?.entries ?? "—"}</span>
      </Field>

      <Field label="Snapshots">
        <span className="text-ui tabular-nums text-text-secondary">{state?.snapshots ?? "—"}</span>
      </Field>

      <Field label="Database size">
        <span className="text-ui tabular-nums text-text-secondary">
          {state ? formatBytes(state.db_size) : "—"}
        </span>
      </Field>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={viewSnapshot}
          disabled={snapLoading}
          className="flex items-center gap-1.5 rounded-xl bg-fill-hover px-4 py-2 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active disabled:opacity-40"
        >
          {snapLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          View latest snapshot
        </button>
        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-ui font-medium text-danger transition-colors hover:bg-fill-hover"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Clear memory
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-ui text-text-secondary">Clear all memory?</span>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-ui font-medium text-danger transition-colors hover:bg-fill-hover disabled:opacity-40"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-lg px-3 py-1.5 text-ui text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary"
            >
              No
            </button>
          </div>
        )}
      </div>

      {snapshot !== null && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-fill-subtle p-4 font-mono text-[12px] leading-relaxed text-code-text ring-1 ring-hairline">
          {snapshot}
        </pre>
      )}
    </>
  );
}

function AboutSection({
  status,
  connected,
  onOpenSkills,
}: {
  status: StatusResult | null;
  connected: boolean;
  onOpenSkills: () => void;
}) {
  void status;
  void connected;
  return (
    <>
      <SectionHeader title="About" hint="Version and backend." />
      <button
        type="button"
        onClick={onOpenSkills}
        className="rounded-lg bg-fill-hover px-3 py-1.5 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active"
      >
        Manage skills
      </button>
    </>
  );
}
