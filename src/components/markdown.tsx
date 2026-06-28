import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import React, { useState } from "react";

const getTextContent = (node: React.ReactNode): string => {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (React.isValidElement(node))
    return getTextContent(
      (node as React.ReactElement<{ children?: React.ReactNode }>).props.children,
    );
  return "";
};

/* Shared markdown components. We map raw tags to our design tokens so
   headings/lists/tables/code blocks all match the sidebar palette. */
export const mdComponents = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="my-2 leading-[1.75]" />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      {...props}
      className="mb-2 mt-4 text-[20px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="mb-2 mt-4 text-[17px] font-semibold tracking-[-0.02em] text-text-primary"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className="mb-1.5 mt-3 text-body font-semibold tracking-[-0.015em] text-text-primary"
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      {...props}
      className="mb-1.5 mt-3 text-ui-lg font-semibold tracking-[-0.01em] text-text-primary"
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="my-2 list-disc space-y-1 pl-6 marker:text-text-muted" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="my-2 list-decimal space-y-1 pl-6 marker:text-text-muted" />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li {...props} className="leading-[1.7]" />,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[#7ab2ff] underline decoration-[#7ab2ff]/40 underline-offset-2 hover:decoration-[#7ab2ff]"
    />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="my-2 border-l-2 border-line pl-3 italic text-text-secondary"
    />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="my-3 border-line" />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-hairline">
      <table {...props} className="w-full text-left text-ui" />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="bg-fill-subtle" />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) => (
    <th
      {...props}
      className="border-b border-hairline px-3 py-1.5 font-medium text-text-secondary"
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableDataCellElement>) => (
    <td
      {...props}
      className="border-b border-hairline px-3 py-1.5 text-text-primary last:border-b-0"
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const { className, children, inline, ...rest } = props;
    if (inline) {
      return (
        <code
          {...rest}
          className="rounded bg-code-bg px-[5px] py-[1px] font-mono text-meta text-code-text"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...rest} className={`${className ?? ""} font-mono text-ui`}>
        {children}
      </code>
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
    const [copied, setCopied] = useState(false);
    const text = getTextContent(props.children);

    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="group relative my-3">
        <pre
          {...props}
          className="overflow-x-auto rounded-xl bg-fill-subtle p-4 pr-12 text-ui leading-[1.55] text-code-text ring-1 ring-hairline"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-[rgba(22,22,22,0.85)] p-1.5 text-text-muted opacity-0 transition-all hover:bg-fill-hover hover:text-text-primary hover:scale-105 active:scale-95 group-hover:opacity-100"
          title="Copy code"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Check className="h-[18px] w-[18px] text-emerald-500" strokeWidth={2} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Copy className="h-[18px] w-[18px]" strokeWidth={2} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    );
  },
  del: (props: React.HTMLAttributes<HTMLModElement>) => (
    <del {...props} className="text-text-muted line-through" />
  ),
  input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    // GFM task-list checkbox. Render as a static styled checkbox-like dot
    // so streamed messages don't try to re-render stateful inputs.
    const checked = props.checked;
    return (
      <span
        className={`mr-1.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
          checked ? "border-[#7ab2ff] bg-[#7ab2ff]/20" : "border-white/20 bg-transparent"
        }`}
      >
        {checked && (
          <svg
            viewBox="0 0 8 8"
            className="h-2.5 w-2.5 text-[#7ab2ff]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-label="Checked"
          >
            <path d="M1 4 L3 6 L7 1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    );
  },
};
