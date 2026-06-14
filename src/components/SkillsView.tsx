import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { SkillInfo } from "../api/types";

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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex min-h-0 flex-1"
    >
      {/* Left panel — same bg as sidebar */}
      <div className="flex w-64 shrink-0 flex-col bg-sidebar">
        {/* Search */}
        <div className="px-3 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-xl bg-white/[0.06] py-1.5 pl-8 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-2 pb-3">
          {loadState === "loading" && (
            <p className="px-2 py-2 text-[13px] text-text-muted">Loading…</p>
          )}
          {loadState === "error" && (
            <p className="px-2 py-2 text-[13px] text-[#e05555]">Failed to load.</p>
          )}
          {loadState === "ok" && filtered.length === 0 && (
            <p className="px-2 py-2 text-[13px] text-text-muted">
              {query ? "No matches." : "No skills installed."}
            </p>
          )}
          {loadState === "ok" &&
            filtered.map((skill) => {
              const active = skill.name === selectedName;
              return (
                <button
                  key={skill.name}
                  onClick={() => setSelectedName(skill.name)}
                  className={`flex w-full flex-col rounded-xl px-2.5 py-2 text-left ${
                    active ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`text-[13.5px] tracking-[-0.01em] ${
                      active ? "font-medium text-white" : "text-[#e0e0e0]"
                    }`}
                  >
                    {skill.name}
                  </span>
                  {skill.description && (
                    <span className="mt-0.5 line-clamp-1 text-[12px] text-text-muted">
                      {skill.description}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Right panel — content area */}
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {selected ? (
          <div className="px-8 py-7">
            <h2 className="text-[18px] font-semibold tracking-[-0.025em] text-text-primary">
              {selected.name}
            </h2>
            {selected.description && (
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                {selected.description}
              </p>
            )}
            {selected.location && (
              <p className="mt-3 font-mono text-[11px] text-text-muted">{selected.location}</p>
            )}
            {selected.content && (
              <pre className="mt-6 whitespace-pre-wrap break-words rounded-xl bg-white/[0.04] px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#ccc]">
                {selected.content}
              </pre>
            )}
          </div>
        ) : loadState === "ok" && skills.length > 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-text-muted">Select a skill</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
