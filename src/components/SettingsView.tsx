import * as React from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
  Check,
  Cpu,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  Loader2,
  Monitor,
  Shield,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AnimatedSliders from "./AnimatedSliders";
import AnimatedArrowLeft from "./AnimatedArrowLeft";
import AnimatedWifi from "./AnimatedWifi";
import AnimatedBot from "./AnimatedBot";
import AnimatedBrain from "./AnimatedBrain";
import AnimatedInfo from "./AnimatedInfo";
import { version as APP_VERSION } from "../../package.json";
import { api } from "../api/client";
import { loadConnection, saveConnection } from "../api/session";
import type { MemoryState, PermissionLevel, PermissionsState, StatusResult } from "../api/types";
import type { Model } from "../types";
import ModelSelector from "./ModelSelector";

export type SettingsSection =
  | "general"
  | "connection"
  | "agent"
  | "permissions"
  | "memory"
  | "about";

interface SettingsViewProps {
  onClose: () => void;
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
  onToggleMode: () => void;
  onOpenSkills: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <AnimatedSliders strokeWidth={1.75} /> },
  { id: "connection", label: "Provider", icon: <AnimatedWifi strokeWidth={1.75} /> },
  { id: "agent", label: "Agent", icon: <AnimatedBot strokeWidth={1.75} /> },
  {
    id: "permissions",
    label: "Permissions",
    icon: <Shield className="h-4 w-4" strokeWidth={1.75} />,
  },
  { id: "memory", label: "Memory", icon: <AnimatedBrain strokeWidth={1.75} /> },
  { id: "about", label: "About", icon: <AnimatedInfo strokeWidth={1.75} /> },
];

function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-text-secondary transition-none hover:bg-fill-hover hover:text-text-primary"
    >
      <AnimatedArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} isHovered={hovered} />
      <span className="text-ui-lg font-medium tracking-[-0.01em]">Back</span>
    </button>
  );
}

interface SettingsNavButtonProps {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function SettingsNavButton({ label, icon, active, onClick }: SettingsNavButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-none hover:bg-fill-hover ${
        active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
      style={{ isolation: "isolate" }}
    >
      {active && (
        <motion.div
          layoutId="active-settings-highlight"
          className="absolute inset-0 rounded-xl bg-fill-active -z-10"
          transition={{ type: "spring", stiffness: 600, damping: 48 }}
        />
      )}
      <span className="relative z-10 shrink-0 [&>svg]:h-4 [&>svg]:w-4">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, { isHovered: hovered || active } as any)
          : icon}
      </span>
      <span className="relative z-10 truncate text-ui-lg font-medium tracking-[-0.01em]">
        {label}
      </span>
    </button>
  );
}

export default function SettingsView({
  onClose,
  status,
  connected,
  models,
  onSelectModel,
  onToggleMode,
  sidebarWidth,
  setSidebarWidth,
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
        <div
          style={{ width: sidebarWidth }}
          className="flex shrink-0 flex-col bg-sidebar border-r border-white/[0.08]"
        >
          <nav className="flex flex-col px-2 pt-2">
            <BackButton onClick={onClose} />

            <div className="h-4" />

            <div className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <SettingsNavButton
                  key={s.id}
                  id={s.id}
                  label={s.label}
                  icon={s.icon}
                  active={s.id === section}
                  onClick={() => setSection(s.id)}
                />
              ))}
            </div>
          </nav>
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
            {section === "permissions" && <PermissionsSection />}
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
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-emerald-500/80" : "bg-fill-strong"
      }`}
    >
      <motion.span
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 45 }}
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white"
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
          <span className="max-w-[280px] truncate text-ui text-text-secondary" title={status?.cwd}>
            {status?.cwd || "—"}
          </span>
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

const PERMISSION_GROUPS: {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "files",
    label: "Files",
    description: "Read, write, delete, and search files on disk.",
    icon: <FolderOpen className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: "shell",
    label: "Shell",
    description: "Run Bash and PowerShell commands.",
    icon: <Terminal className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: "search",
    label: "Web & Search",
    description: "Browse the web, fetch URLs, run web searches.",
    icon: <Globe className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: "pc_control",
    label: "PC Control",
    description: "Control mouse, keyboard, screen, clipboard, and windows.",
    icon: <Monitor className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: "processes",
    label: "Processes",
    description: "List and kill running processes.",
    icon: <Cpu className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: "system",
    label: "System",
    description: "Read system info and send desktop notifications.",
    icon: <Shield className="h-4 w-4" strokeWidth={1.75} />,
  },
];

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "ask", label: "Ask" },
  { value: "allow", label: "Allow" },
];

function PermissionSelector({
  value,
  onChange,
  disabled,
}: {
  value: PermissionLevel;
  onChange: (v: PermissionLevel) => void;
  disabled?: boolean;
}) {
  const id = React.useId();

  return (
    <LayoutGroup id={id}>
      <div className="flex rounded-lg border border-hairline bg-fill-subtle p-0.5 gap-0.5">
        {PERMISSION_LEVELS.map((level) => {
          const active = value === level.value;
          const pillColor =
            level.value === "block"
              ? "rgba(239, 68, 68, 0.15)"
              : level.value === "allow"
                ? "rgba(52, 211, 153, 0.15)"
                : "rgba(255, 255, 255, 0.08)";
          const activeText =
            level.value === "block"
              ? "text-red-400"
              : level.value === "allow"
                ? "text-emerald-400"
                : "text-text-primary";

          return (
            <button
              key={level.value}
              type="button"
              disabled={disabled}
              onClick={() => { if (!active) onChange(level.value); }}
              style={{ isolation: "isolate" }}
              className={`relative px-3 py-1.5 text-ui font-medium rounded-md ${
                active ? activeText : "text-text-muted"
              } disabled:opacity-40`}
            >
              {active && (
                <motion.div
                  layoutId="pill"
                  initial={false}
                  animate={{ backgroundColor: pillColor }}
                  transition={{ type: "spring", stiffness: 500, damping: 42 }}
                  className="absolute inset-0 rounded-md pointer-events-none"
                />
              )}
              <span className="relative z-10">{level.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function PermissionsSection() {
  const [perms, setPerms] = useState<PermissionsState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPermissions()
      .then(setPerms)
      .catch(() => setPerms(null));
  }, []);

  const handleChange = async (group: string, value: PermissionLevel) => {
    if (!perms) return;
    const prev = perms[group as keyof PermissionsState];
    setPerms({ ...perms, [group]: value });
    setSaving(group);
    try {
      await api.setPermission(group, value);
    } catch {
      setPerms({ ...perms, [group]: prev });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <SectionHeader title="Permissions" />

      <p className="mb-5 text-ui text-text-muted">
        Control which capabilities the agent can use.{" "}
        <strong className="text-text-secondary font-medium">Block</strong> disables a group
        entirely. <strong className="text-text-secondary font-medium">Ask</strong> always prompts
        before using it. <strong className="text-text-secondary font-medium">Allow</strong> lets it
        run without asking.
      </p>

      <FieldGroup>
        {PERMISSION_GROUPS.map((group) => {
          const current = (perms?.[group.id as keyof PermissionsState] ?? "ask") as PermissionLevel;
          return (
            <Field key={group.id} label={group.label} description={group.description}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-text-muted">{group.icon}</span>
                <PermissionSelector
                  value={current}
                  onChange={(v) => handleChange(group.id, v)}
                  disabled={!perms || saving === group.id}
                />
              </div>
            </Field>
          );
        })}
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
