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
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { version as APP_VERSION } from "../../package.json";
import { api } from "../api/client";
import { loadConnection, saveConnection } from "../api/session";
import type { MemoryState, StatusResult } from "../api/types";
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
          <nav className="flex flex-col px-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-text-secondary transition-none hover:bg-fill-hover hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="text-ui-lg font-medium tracking-[-0.01em]">Back</span>
            </button>

            <div className="mx-1 my-2 h-px bg-hairline" />

            <div className="flex flex-col gap-0.5">
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
            </div>
          </nav>
        </div>

        {/* Right panel — content */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <div className="mx-auto max-w-2xl px-8 py-8">
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
            {section === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-6 text-2xl font-semibold tracking-[-0.03em] text-text-primary">{title}</h2>
  );
}

function FieldGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {label && (
        <p className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.07em] text-text-muted">
          {label}
        </p>
      )}
      {/* No overflow-hidden — lets dropdowns escape the card boundary */}
      <div className="rounded-xl border border-hairline">{children}</div>
    </div>
  );
}

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
    <div className="flex items-center gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0">
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
      <SectionHeader title="General" />

      <FieldGroup>
        <Field label="Working directory" description="Where the agent reads and writes files.">
          <span
            className="max-w-[280px] truncate text-ui text-text-secondary"
            title={status?.cwd}
          >
            {status?.cwd || "—"}
          </span>
        </Field>

        <Field label="Theme" description="Light theme is coming later.">
          <span className="text-ui text-text-muted">Dark</span>
        </Field>
      </FieldGroup>
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
      <SectionHeader title="Provider" />

      <FieldGroup>
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
      </FieldGroup>

      <FieldGroup label="API Key">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2">
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
      </FieldGroup>
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
  const auto = status?.mode === "auto";

  return (
    <>
      <SectionHeader title="Agent" />

      <FieldGroup>
        <Field
          label="Auto mode"
          description="Run tools without asking for confirmation. Off = ask before risky actions."
        >
          <Toggle checked={auto} onChange={onToggleMode} label="Toggle auto mode" />
        </Field>
      </FieldGroup>
    </>
  );
}

function MemorySection() {
  const [state, setState] = useState<MemoryState | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <>
      <SectionHeader title="Memory" />

      <FieldGroup>
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
      </FieldGroup>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <SectionHeader title="About" />

      <FieldGroup>
        <Field label="Version">
          <span className="text-ui tabular-nums text-text-secondary">{APP_VERSION}</span>
        </Field>
      </FieldGroup>
    </>
  );
}
