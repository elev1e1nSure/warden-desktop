import ky, { HTTPError } from "ky";
import type { ZodType } from "zod";
import type { Block } from "../types";
import {
  AppSettingsSchema,
  ChatListSchema,
  ChatWrapSchema,
  ClearMemorySchema,
  CompactSchema,
  ConnectSchema,
  MemoryStateSchema,
  ModelsSchema,
  OkSchema,
  PermissionsSchema,
  SkillsListSchema,
  SkillWrapSchema,
  StatusSchema,
  UploadSchema,
} from "./schemas";
import type { AppSettings, MemorySnapshot, PermissionLevel } from "./types";

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

async function getJSON<T>(path: string, schema?: ZodType<T>): Promise<T> {
  try {
    const data = await client.get(path).json<unknown>();
    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw parsed.error;
      return parsed.data;
    }
    return data as T;
  } catch (err) {
    if (err instanceof HTTPError) {
      throw new Error(`GET ${path} -> ${err.response.status}`);
    }
    throw err;
  }
}

async function postJSON<T = unknown>(
  path: string,
  body?: unknown,
  schema?: ZodType<T>,
): Promise<T> {
  try {
    const res = await client.post(path, body !== undefined ? { json: body } : {});
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      const data = JSON.parse(text) as unknown;
      if (schema) {
        const parsed = schema.safeParse(data);
        if (!parsed.success) throw parsed.error;
        return parsed.data;
      }
      return data as T;
    } catch (parseErr) {
      if (parseErr && typeof parseErr === "object" && "issues" in parseErr) throw parseErr;
      return text as unknown as T;
    }
  } catch (err) {
    if (err instanceof HTTPError) {
      const t = await err.response.text().catch(() => "");
      throw new Error(t || `POST ${path} -> ${err.response.status}`);
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

  status: () => getJSON("/status", StatusSchema),

  connect: (apiKey: string) => postJSON("/connect", { api_key: apiKey }, ConnectSchema),

  listModels: () => getJSON("/models", ModelsSchema),

  setModel: (model: string) => postJSON("/model/set", { model }),

  setMode: (mode: "ask" | "auto" | "custom") => postJSON("/mode", { mode }),

  confirm: (id: string, ok: boolean) => postJSON("/confirm", { id, ok }),

  answerQuestion: (id: string, answers: string[][]) => postJSON("/question", { id, answers }),

  reset: () => postJSON("/reset"),

  listChats: () => getJSON("/chats", ChatListSchema),

  newChat: () => postJSON("/chats/new", undefined, ChatWrapSchema),

  selectChat: (id: string) => postJSON("/chats/select", { id }, ChatWrapSchema),
  getChat: (id: string) => getJSON(`/chats/${id}`, ChatWrapSchema),

  saveChatBlocks: (id: string, blocks: Block[]) => postJSON("/chats/blocks", { id, blocks }),

  renameChat: (id: string, title: string) => postJSON("/chats/rename", { id, title }),

  deleteChat: (id: string) => postJSON("/chats/delete", { id }),

  compact: () => postJSON("/compact", undefined, CompactSchema),

  skills: () => getJSON("/skills", SkillsListSchema),

  createSkill: (name: string, description: string, content: string) =>
    postJSON("/skills/create", { name, description, content }, SkillWrapSchema),

  updateSkill: (name: string, description?: string, content?: string) =>
    postJSON("/skills/update", { name, description, content }, SkillWrapSchema),

  deleteSkill: (name: string) => postJSON("/skills/delete", { name }, OkSchema),

  getPermissions: () => getJSON("/permissions", PermissionsSchema),

  setPermission: (group: string, value: PermissionLevel) =>
    postJSON("/permissions", { group, value }),

  memoryState: () => getJSON("/memory/state", MemoryStateSchema),

  setMemory: (enabled: boolean) => postJSON("/memory/state", { enabled }),

  clearMemory: () => postJSON("/memory/clear", undefined, ClearMemorySchema),

  memorySnapshot: () => getJSON<MemorySnapshot>("/memory/snapshot"),

  getSettings: () => getJSON("/settings", AppSettingsSchema),

  setSettings: (settings: Partial<AppSettings>) =>
    postJSON("/settings", settings, AppSettingsSchema),

  shutdown: () => postJSON("/shutdown"),

  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("files", file);
    const res = await client.post("upload", { body: form });
    const data = await res.json<{ files: { id: string }[] }>();
    const parsed = UploadSchema.parse(data);
    return parsed.files[0]?.id ?? "";
  },
};
