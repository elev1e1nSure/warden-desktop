// NDJSON streaming client for POST /chat.
import { API_BASE } from "./client";
import type { ChatEvent } from "./types";

export interface ChatPayload {
  text: string;
  files?: string[];
}

/**
 * Streams a chat turn. Invokes `onEvent` for every parsed NDJSON line until the
 * backend ends the response (a `done` or `error` event). The same request stays
 * open across confirm/question round-trips — the caller answers those via the
 * REST client and the backend resumes emitting on this stream.
 */
export async function streamChat(
  payload: ChatPayload,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    onEvent({ type: "error", text: `network error: ${String(err)}` });
    onEvent({ type: "done", token_count: 0, token_limit: 0 });
    return;
  }

  if (!res.ok || !res.body) {
    onEvent({ type: "error", text: `server error: ${res.status}` });
    onEvent({ type: "done", token_count: 0, token_limit: 0 });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ChatEvent);
    } catch {
      // ignore malformed lines, matching the Go scanner behaviour
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        flushLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    flushLine(buffer);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    onEvent({ type: "error", text: String(err) });
    onEvent({ type: "done", token_count: 0, token_limit: 0 });
  }
}
