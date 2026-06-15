export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
  model?: string;
}

export interface Model {
  id: string;
  name: string;
  description: string;
}

// Live agent timeline. The chat stream is rendered as an ordered list of blocks.
export type Block =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "think"; text: string }
  | { id: string; kind: "error"; text: string }
  | {
      id: string;
      kind: "tool";
      name: string;
      args: string;
      result?: string;
      diff?: string;
      status: "running" | "done";
    };
