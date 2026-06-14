import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import type { QuestionEvent } from "../api/types";

interface QuestionModalProps {
  request: QuestionEvent;
  onSubmit: (answers: string[][]) => void;
}

export default function QuestionModal({ request, onSubmit }: QuestionModalProps) {
  const [answers, setAnswers] = useState<string[][]>(request.questions.map(() => []));

  const toggle = (qi: number, label: string, multiple: boolean) => {
    setAnswers((prev) => {
      const next = prev.map((a) => [...a]);
      const current = next[qi];
      if (!current) return prev;
      if (multiple) {
        next[qi] = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
      } else {
        next[qi] = current.includes(label) ? [] : [label];
      }
      return next;
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-raised shadow-2xl"
      >
        <div className="border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">
            The agent needs your input
          </h2>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {request.questions.map((q, qi) => (
            <div key={qi} className="space-y-2">
              {q.header && (
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {q.header}
                </p>
              )}
              <p className="text-sm text-text-primary">{q.question}</p>
              {q.multiple && <p className="text-xs text-text-muted">Select all that apply</p>}
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt) => {
                  const selected = answers[qi]?.includes(opt.label) ?? false;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => toggle(qi, opt.label, Boolean(q.multiple))}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-[#8AB89A]/60 bg-[#8AB89A]/10"
                          : "border-white/[0.08] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          q.multiple ? "rounded" : "rounded-full"
                        } border ${
                          selected ? "border-[#8AB89A] bg-[#8AB89A] text-black" : "border-white/20"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm text-text-primary">{opt.label}</span>
                        {opt.description && (
                          <span className="block text-xs text-text-muted">{opt.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-white/[0.07] px-5 py-3">
          <button
            onClick={() => onSubmit(answers)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Submit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
