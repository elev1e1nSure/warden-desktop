import { z } from "zod";

export const StatusSchema = z.object({
  model: z.string(),
  provider: z.string(),
  connected: z.boolean(),
  mode: z.enum(["ask", "auto", "custom"]),
  cwd: z.string(),
  token_count: z.number(),
  token_limit: z.number(),
});

export const ModelsSchema = z.object({
  models: z.array(z.string()),
  current: z.string(),
  error: z.string(),
});

export const ConnectSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  location: z.string(),
  content: z.string().optional(),
});

export const SkillsListSchema = z.object({
  skills: z.array(SkillSchema),
});

export const SkillWrapSchema = z.object({
  skill: SkillSchema,
});

export const MemoryStateSchema = z.object({
  enabled: z.boolean(),
  entries: z.number(),
  snapshots: z.number(),
  db_size: z.number(),
});

export const ClearMemorySchema = z.object({
  cleared: z.number(),
});

export const ChatSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  title_source: z.enum(["manual", "user", "llm"]),
  created_at: z.string(),
  updated_at: z.string(),
  timestamp: z.string(),
  model: z.string().optional(),
});

export const ChatDetailSchema = ChatSummarySchema.extend({
  blocks: z.array(z.any()),
});

export const ChatListSchema = z.object({
  chats: ChatSummarySchema.array(),
  active_chat_id: z.string().nullable(),
});

export const ChatWrapSchema = z.object({
  chat: ChatDetailSchema,
});

export const AppSettingsSchema = z.object({
  disable_system_prompt: z.boolean(),
});

export const OkSchema = z.object({
  ok: z.boolean(),
});

export const CompactSchema = z.object({
  summary: z.string(),
  tokens_before: z.number(),
  tokens_after: z.number(),
});

export const PermissionsSchema = z.object({
  files: z.enum(["block", "ask", "allow"]),
  shell: z.enum(["block", "ask", "allow"]),
  search: z.enum(["block", "ask", "allow"]),
  pc_control: z.enum(["block", "ask", "allow"]),
  processes: z.enum(["block", "ask", "allow"]),
  system: z.enum(["block", "ask", "allow"]),
});

export const UploadSchema = z.object({
  files: z.array(z.object({ id: z.string() })),
});
