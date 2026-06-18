import ky, { HTTPError } from "ky";
import type { Block } from "../types";
import type {
  AppSettings,
  ChatDetail,
  ChatListResult,
  ConnectResult,
  MemorySnapshot,
  MemoryState,
  ModelsResult,
  PermissionLevel,
  PermissionsState,
  SkillInfo,
  StatusResult,
} from "./types";

export const API_BASE = "http://127.0.0.1:8765";

let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return authToken ? { ...extra, "X-Warden-Token": authToken } : extra;
}

const client = ky.create({
  prefix: API_BASE,
  timeout: 30_000,
  retry: 0,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        if (authToken) request.headers.set("X-Warden-Token", authToken);
      },
    ],
  },
});

async function getJSON<T>(path: string): Promise<T> {
  try {
    return await client.get(path).json<T>();
  } catch (err) {
    if (err instanceof HTTPError) {
      throw new Error(`GET ${path} -> ${err.response.status}`);
    }
    throw err;
  }
}

async function postJSON<T = unknown>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await client.post(path, body !== undefined ? { json: body } : {});
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } catch (err) {
    if (err instanceof HTTPError) {
      const text = await err.response.text().catch(() => "");
      throw new Error(text || `POST ${path} -> ${err.response.status}`);
    }
    throw err;
  }
}

export const api = {
  async health(): Promise<boolean> {
    try {
      const res = await client.get("health");
      return res.ok;
    } catch {
      return false;
    }
  },

  status: () => getJSON<StatusResult>("/status"),

  connect: (apiKey: string) => postJSON<ConnectResult>("/connect", { api_key: apiKey }),

  listModels: () => getJSON<ModelsResult>("/models"),

  setModel: (model: string) => postJSON("/model/set", { model }),

  setMode: (mode: "ask" | "auto" | "custom") => postJSON("/mode", { mode }),

  confirm: (id: string, ok: boolean) => postJSON("/confirm", { id, ok }),

  answerQuestion: (id: string, answers: string[][]) => postJSON("/question", { id, answers }),

  reset: () => postJSON("/reset"),

  listChats: () => getJSON<ChatListResult>("/chats"),

  newChat: () => postJSON<{ chat: ChatDetail }>("/chats/new"),

  selectChat: (id: string) => postJSON<{ chat: ChatDetail }>("/chats/select", { id }),
  getChat: (id: string) => getJSON<{ chat: ChatDetail }>(`/chats/${id}`),

  saveChatBlocks: (id: string, blocks: Block[]) => postJSON("/chats/blocks", { id, blocks }),

  renameChat: (id: string, title: string) => postJSON("/chats/rename", { id, title }),

  deleteChat: (id: string) => postJSON("/chats/delete", { id }),

  compact: () =>
    postJSON<{ summary: string; tokens_before: number; tokens_after: number }>("/compact"),

  skills: () => getJSON<{ skills: SkillInfo[] }>("/skills"),

  createSkill: (name: string, description: string, content: string) =>
    postJSON<{ skill: SkillInfo }>("/skills/create", { name, description, content }),

  updateSkill: (name: string, description?: string, content?: string) =>
    postJSON<{ skill: SkillInfo }>("/skills/update", { name, description, content }),

  deleteSkill: (name: string) => postJSON<{ ok: boolean }>("/skills/delete", { name }),

  getPermissions: () => getJSON<PermissionsState>("/permissions"),

  setPermission: (group: string, value: PermissionLevel) =>
    postJSON("/permissions", { group, value }),

  memoryState: () => getJSON<MemoryState>("/memory/state"),

  setMemory: (enabled: boolean) => postJSON("/memory/state", { enabled }),

  clearMemory: () => postJSON<{ cleared: number }>("/memory/clear"),

  memorySnapshot: () => getJSON<MemorySnapshot>("/memory/snapshot"),

  getSettings: () => getJSON<AppSettings>("/settings"),

  setSettings: (settings: Partial<AppSettings>) => postJSON<AppSettings>("/settings", settings),

  shutdown: () => postJSON("/shutdown"),

  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("files", file);
    const res = await client.post("upload", { body: form });
    const data = await res.json<{ files: { id: string }[] }>();
    return data.files[0]?.id ?? "";
  },
};
