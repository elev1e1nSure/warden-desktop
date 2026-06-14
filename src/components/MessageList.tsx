import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Message } from "../types";

interface MessageListProps {
  messages: Message[];
}

function Bubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.2),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] text-[15px] leading-7 tracking-[-0.01em] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5 text-text-primary"
            : "px-1 py-0.5 text-text-primary/85"
        }`}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-6">
      {messages.map((m, i) => (
        <Bubble key={m.id} message={m} index={i} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
