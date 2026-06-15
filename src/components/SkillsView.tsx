import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { SkillInfo } from "../api/types";
import { HIGHLIGHT_SPRING, skillDetail } from "../motion";

type LoadState = "idle" | "loading" | "ok" | "error";

export default function SkillsView({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadState("loading");
    api
      .skills()
      .then((res) => {
        setSkills(res.skills ?? []);
        setLoadState("ok");
        const first = res.skills?.[0];
        if (first) setSelectedName(first.name);
      })
      .catch(() => setLoadState("error"));
  }, []);

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
                  return (
                    <button
                      type="button"
                      key={skill.name}
                      onClick={() => setSelectedName(skill.name)}
                      className={`relative flex w-full rounded-xl px-2.5 py-1.5 text-left ${
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
                        className={`relative z-10 block truncate text-ui-lg tracking-[-0.01em] ${
                          active ? "font-medium text-text-primary" : "text-text-secondary"
                        }`}
                      >
                        {skill.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — content area */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.name}
                initial={skillDetail.initial}
                animate={skillDetail.animate}
                exit={skillDetail.exit}
                transition={skillDetail.transition}
                className="px-8 py-7"
              >
                <h2 className="text-title font-semibold tracking-[-0.02em] text-text-primary">
                  {selected.name}
                </h2>
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
                className="flex h-full items-center justify-center"
              >
                <p className="text-ui text-text-muted">Select a skill</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
