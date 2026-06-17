import { motion } from "framer-motion";
import { ArrowLeft, Bot, Brain, Info, SlidersHorizontal, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StatusResult } from "../api/types";
import { skillDetailDown } from "../motion";

export type SettingsSection = "general" | "connection" | "agent" | "memory" | "about";

interface SettingsViewProps {
  onClose: () => void;
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
  onToggleMode: () => void;
  onOpenConnect: () => void;
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
  onOpenConnect,
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
                onOpenConnect={onOpenConnect}
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
  onOpenConnect,
}: {
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
  onOpenConnect: () => void;
}) {
  // Suppress unused-var lint until the section is filled in (step 2).
  void models;
  void onSelectModel;
  return (
    <>
      <SectionHeader title="Provider" hint="API connection and default model." />
      <p className="text-ui-lg text-text-muted">
        {connected ? `Connected · ${status?.provider ?? ""}` : "Not connected"}
      </p>
      <button
        type="button"
        onClick={onOpenConnect}
        className="mt-3 rounded-lg bg-fill-hover px-3 py-1.5 text-ui font-medium text-text-primary transition-colors hover:bg-fill-active"
      >
        {connected ? "Reconnect" : "Connect"}
      </button>
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
  void onToggleMode;
  return (
    <>
      <SectionHeader title="Agent" hint="Execution behavior and context." />
      <p className="text-ui-lg text-text-muted">Mode: {status?.mode ?? "—"}</p>
    </>
  );
}

function MemorySection() {
  return (
    <>
      <SectionHeader title="Memory" hint="Long-term memory across chats." />
      <p className="text-ui-lg text-text-muted">—</p>
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
