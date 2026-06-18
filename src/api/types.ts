// Mirrors the wire types emitted by the aiohttp backend (agent/server.py).
import type { Block } from "../types";

export interface StatusResult {
  model: string;
  provider: string;
  connected: boolean;
  mode: "ask" | "auto";
  cwd: string;
  token_count: number;
  token_limit: number;
}

export interface ModelsResult {
  models: string[];
  current: string;
  error: string;
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  location: string;
  content?: string;
}

export interface MemoryState {
  enabled: boolean;
  entries: number;
  snapshots: number;
  db_size: number;
}

export type MemorySnapshot = Record<string, unknown>;

export interface ChatSummary {
  id: string;
  title: string;
  title_source: "manual" | "user" | "llm";
  created_at: string;
  updated_at: string;
  timestamp: string;
  model?: string;
}

export interface ChatDetail extends ChatSummary {
  blocks: Block[];
}

export interface ChatListResult {
  chats: ChatSummary[];
  active_chat_id: string | null;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionItem {
  question: string;
  header?: string;
  multiple?: boolean;
  options: QuestionOption[];
}

// NDJSON events streamed from POST /chat.
export type ChatEvent =
  | { type: "warden_start" }
  | { type: "title"; chat_id: string; title: string }
  | { type: "token"; text: string }
  | { type: "think"; text: string }
  | { type: "tool_start"; name: string; args: string }
  | { type: "tool"; name: string; args: string; result: string; diff?: string }
  | {
      type: "confirm";
      id: string;
      tool: string;
      risk: string;
      title: string;
      summary: string;
      details: string[];
      args: string;
      preview: string;
      default: string;
    }
  | { type: "question"; id: string; questions: QuestionItem[] }
  | { type: "done"; token_count: number; token_limit: number }
  | { type: "error"; text: string };

export type ConfirmEvent = Extract<ChatEvent, { type: "confirm" }>;
export type QuestionEvent = Extract<ChatEvent, { type: "question" }>;
