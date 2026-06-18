import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuestionEvent } from "../api/types";

interface QuestionModalProps {
  request: QuestionEvent;
  onSubmit: (answers: string[][]) => void;
}

export default function QuestionModal({ request, onSubmit }: QuestionModalProps) {
  const [answers, setAnswers] = useState<string[][]>(request.questions.map(() => []));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSubmit(answers);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onSubmit, answers]);

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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border-2 border-line bg-[rgba(22,22,22,0.88)]"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-ui-lg font-semibold tracking-[-0.01em] text-text-primary">
          The agent needs your input
        </p>
      </div>

      {/* Questions */}
      <div className="max-h-72 space-y-4 overflow-y-auto px-4 pb-3 no-scrollbar">
        {request.questions.map((q, qi) => (
          <div key={q.question} className="space-y-2">
            {q.header && (
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-text-muted">
                {q.header}
              </p>
            )}
            <p className="text-ui text-text-primary">{q.question}</p>
            <div className="flex flex-col gap-1">
              {q.options.map((opt) => {
                const selected = answers[qi]?.includes(opt.label) ?? false;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => toggle(qi, opt.label, Boolean(q.multiple))}
                    className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                      selected ? "bg-fill-active" : "hover:bg-fill-hover"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
                        q.multiple ? "rounded" : "rounded-full"
                      } ${selected ? "border-white bg-white text-black" : "border-white/20"}`}
                    >
                      {selected && <Check className="h-2.5 w-2.5" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-ui text-text-primary">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[12px] text-text-muted">{opt.description}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end px-3 pb-3">
        <button
          type="button"
          onClick={() => onSubmit(answers)}
          className="rounded-xl bg-white px-3 py-2 text-ui font-semibold text-black transition-colors hover:bg-white/90"
        >
          Submit
        </button>
      </div>
    </motion.div>
  );
}
