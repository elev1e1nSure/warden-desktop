// REST wrappers around the local Python backend.

import type { Block } from "../types";
import type {
  ChatDetail,
  ChatListResult,
  ConnectResult,
  MemoryState,
  ModelsResult,
  SkillInfo,
  StatusResult,
} from "./types";

export const API_BASE = "http://localhost:8765";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `POST ${path} -> ${res.status}`);
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  /** Returns true when the backend answers /health. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  status: () => getJSON<StatusResult>("/status"),

  connect: (apiKey: string) =>
    postJSON<ConnectResult>("/connect", {
      api_key: apiKey,
    }),

  listModels: () => getJSON<ModelsResult>("/models"),

  setModel: (model: string) => postJSON("/model/set", { model }),

  setMode: (auto: boolean) => postJSON("/mode", { auto }),

  confirm: (id: string, ok: boolean) => postJSON("/confirm", { id, ok }),

  answerQuestion: (id: string, answers: string[][]) => postJSON("/question", { id, answers }),

  reset: () => postJSON("/reset"),

  listChats: () => getJSON<ChatListResult>("/chats"),

  newChat: () => postJSON<{ chat: ChatDetail }>("/chats/new"),

  selectChat: (id: string) => postJSON<{ chat: ChatDetail }>("/chats/select", { id }),

  saveChatBlocks: (id: string, blocks: Block[]) => postJSON("/chats/blocks", { id, blocks }),

  renameChat: (id: string, title: string) => postJSON("/chats/rename", { id, title }),

  deleteChat: (id: string) => postJSON("/chats/delete", { id }),

  compact: () =>
    postJSON<{ summary: string; tokens_before: number; tokens_after: number }>("/compact"),

  skills: () => getJSON<{ skills: SkillInfo[] }>("/skills"),

  memoryState: () => getJSON<MemoryState>("/memory/state"),

  setMemory: (enabled: boolean) => postJSON("/memory/state", { enabled }),

  clearMemory: () => postJSON<{ cleared: number }>("/memory/clear"),

  shutdown: () => postJSON("/shutdown"),

  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("files", file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    const data = (await res.json()) as { files: { id: string }[] };
    return data.files[0]?.id ?? "";
  },
};
