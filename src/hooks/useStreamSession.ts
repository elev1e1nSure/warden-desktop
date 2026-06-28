import { useCallback, useRef, useState } from "react";
import { api } from "../api/client";
import { streamChat } from "../api/stream";
import type { ChatEvent, ConfirmEvent, QuestionEvent } from "../api/types";
import type { AttachedFile } from "../components/InputBar";
import type { Block, Chat } from "../types";

const cleanLLMTokens = (str: string): string => {
  return str.replace(
    /<\|eom\|>|<\|eot_id\|>|<\|eom_id\|>|<\|im_end\|>|<\|im_start\|>|<\|end_of_text\|>|<\|endoftext\|>|<\/s>|<s>|<pad>/gi,
    "",
  );
};

export interface UseStreamSessionParams {
  connected: boolean;
  blocksRef: React.MutableRefObject<Block[]>;
  commit: (next: Block[]) => void;
  genId: () => string;
  stripEmptyThink: (blocks: Block[]) => Block[];
  refreshStatus: () => Promise<unknown>;
  loadChats: () => Promise<unknown>;
  setFollowTimeline: (v: boolean) => void;
  setActiveChatId: React.Dispatch<React.SetStateAction<string | null>>;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  // Persist the active chat's blocks (DB + cache) right after a stream ends,
  // before loadChats prefetches from the DB — prevents a race where the
  // debounced save hasn't landed yet and the cache gets filled with empty
  // blocks for the just-created chat. Awaited in the stream's finally so
  // loadChats reads the DB after the write committed.
  persistActiveChatBlocks: () => Promise<void>;
  // Ref to the active chat id, kept in sync synchronously in the title event
  // so persistActiveChatBlocks works before React re-renders.
  activeChatIdRef: React.MutableRefObject<string | null>;
}

export interface UseStreamSessionResult {
  streaming: boolean;
  confirmReq: ConfirmEvent | null;
  questionReq: QuestionEvent | null;
  onEvent: (e: ChatEvent) => void;
  handleSend: (text: string, files: AttachedFile[]) => Promise<void>;
  handleStop: () => void;
  handleConfirm: (ok: boolean) => Promise<void>;
  handleAnswer: (answers: string[][]) => Promise<void>;
}

const nowTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function useStreamSession({
  connected,
  blocksRef,
  commit,
  genId,
  stripEmptyThink,
  refreshStatus,
  loadChats,
  setFollowTimeline,
  setActiveChatId,
  setChats,
  persistActiveChatBlocks,
  activeChatIdRef,
}: UseStreamSessionParams): UseStreamSessionResult {
  const [streaming, setStreaming] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmEvent | null>(null);
  const [questionReq, setQuestionReq] = useState<QuestionEvent | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const thinkIdRef = useRef<string | null>(null);
  const toolIdRef = useRef<string | null>(null);
  // Work-chain timing: set on first warden_start, used to compute elapsed for
  // the "Worked for Xs" summary block. Cleared after each handleSend cycle.
  const workStartRef = useRef<number>(0);
  const workEndedRef = useRef<boolean>(false);

  const appendText = useCallback(
    (slot: React.MutableRefObject<string | null>, kind: "assistant" | "think", text: string) => {
      const cur = slot.current;
      const list = blocksRef.current;
      if (cur) {
        commit(
          list.map((b) =>
            b.id === cur && b.kind === kind ? { ...b, text: cleanLLMTokens(b.text + text) } : b,
          ),
        );
      } else {
        const id = genId();
        slot.current = id;
        commit([...list, { id, kind, text: cleanLLMTokens(text) }]);
      }
    },
    [commit, genId, blocksRef],
  );

  // Opens a fresh, empty reasoning block at the end of the timeline and points
  // thinkIdRef at it. This block IS the "Thinking…" indicator; think tokens fill
  // it and it settles into a "Thought" once the agent moves on. Empty ones are
  // stripped before persisting (stripEmptyThink).
  const openThink = useCallback(() => {
    const id = genId();
    thinkIdRef.current = id;
    commit([...blocksRef.current, { id, kind: "think", text: "" }]);
  }, [commit, genId, blocksRef]);

  const onEvent = useCallback(
    (e: ChatEvent) => {
      switch (e.type) {
        case "warden_start":
          // Each agent iteration starts a fresh assistant slot. Open a new
          // reasoning indicator unless one is already open (e.g. the eager one
          // created on send for the very first iteration).
          // Reset work-chain tracking so each iteration gets its own
          // "Worked for Xs" block, even in multi-turn tool chains.
          workStartRef.current = Date.now();
          workEndedRef.current = false;
          assistantIdRef.current = null;
          if (thinkIdRef.current === null) openThink();
          break;
        case "title":
          // Update the ref synchronously so persistActiveChatBlocks (called in
          // the stream's finally, before React re-renders) can see the just-
          // resolved chat id. Without this, the first message's blocks would
          // be flushed with id=null and never reach the DB.
          activeChatIdRef.current = e.chat_id;
          setActiveChatId(e.chat_id);
          setChats((prev) => {
            const idx = prev.findIndex((chat) => chat.id === e.chat_id);
            const timestamp = nowTimestamp();
            if (idx === -1) {
              return [
                { id: e.chat_id, title: e.title, timestamp, messages: [] as Chat["messages"] },
                ...prev,
              ];
            }
            return prev.map((chat) =>
              chat.id === e.chat_id ? { ...chat, title: e.title, timestamp } : chat,
            );
          });
          break;
        case "token":
          // Don't close the think slot here. Some models stream the answer
          // before their reasoning; keeping thinkIdRef pointed at this
          // iteration's think block means late reasoning lands in it — which
          // sits ABOVE the assistant block — instead of spawning a new "Thought"
          // below the answer. The block settles to "Thought" purely by position
          // (it's no longer the last block) once assistant content appears.
          //
          // First token signals that tool usage is done — insert the work-chain
          // boundary block so groupBlocks can collapse think/tool rows.
          if (workStartRef.current > 0 && !workEndedRef.current) {
            workEndedRef.current = true;
            const elapsed = Math.max(1, Math.round((Date.now() - workStartRef.current) / 1000));
            commit([...blocksRef.current, { id: genId(), kind: "agent-work-end", elapsed }]);
          }
          appendText(assistantIdRef, "assistant", e.text);
          break;
        case "think": {
          if (thinkIdRef.current === null) openThink();
          const cur = thinkIdRef.current;
          commit(
            blocksRef.current.map((b) =>
              b.id === cur && b.kind === "think"
                ? { ...b, text: cleanLLMTokens(b.text + e.text) }
                : b,
            ),
          );
          break;
        }
        case "tool_start": {
          const id = genId();
          toolIdRef.current = id;
          assistantIdRef.current = null;
          thinkIdRef.current = null;
          commit([
            ...blocksRef.current,
            { id, kind: "tool", name: e.name, args: e.args, status: "running" },
          ]);
          break;
        }
        case "tool": {
          const running = toolIdRef.current;
          if (running) {
            toolIdRef.current = null;
            commit(
              blocksRef.current.map((b) =>
                b.id === running && b.kind === "tool"
                  ? { ...b, result: e.result, diff: e.diff, status: "done" }
                  : b,
              ),
            );
          } else {
            commit([
              ...blocksRef.current,
              {
                id: genId(),
                kind: "tool",
                name: e.name,
                args: e.args,
                result: e.result,
                diff: e.diff,
                status: "done",
              },
            ]);
          }
          assistantIdRef.current = null;
          thinkIdRef.current = null;
          break;
        }
        case "confirm":
          setConfirmReq(e);
          break;
        case "question":
          setQuestionReq(e);
          break;
        case "done":
          break;
        case "error":
          assistantIdRef.current = null;
          commit([...blocksRef.current, { id: genId(), kind: "error", text: e.text.trim() }]);
          break;
      }
    },
    [appendText, commit, genId, openThink, blocksRef, setActiveChatId, setChats, activeChatIdRef],
  );

  const handleSend = useCallback(
    async (text: string, files: AttachedFile[]) => {
      if (streaming || !connected) return;
      assistantIdRef.current = null;
      thinkIdRef.current = null;
      toolIdRef.current = null;
      workStartRef.current = 0;
      workEndedRef.current = false;

      let fileIds: string[] = [];
      if (files.length > 0) {
        try {
          const results = await Promise.all(files.map((f) => api.uploadFile(f.file)));
          fileIds = results.filter(Boolean);
        } catch {
          commit([
            ...blocksRef.current,
            { id: genId(), kind: "error", text: "File upload failed." },
          ]);
          return;
        }
      }

      if (files.length > 0 && fileIds.length === 0) {
        commit([
          ...blocksRef.current,
          { id: genId(), kind: "error", text: "All file uploads failed; nothing was sent." },
        ]);
        return;
      }

      const next = [...blocksRef.current];

      for (const f of files) {
        if (f.file.type.startsWith("image/") && f.previewUrl) {
          next.push({
            id: genId(),
            kind: "image",
            name: f.file.name,
            url: f.previewUrl,
          });
        }
      }

      const displayText = text || (files.length > 0 ? `[${files.length} file(s) attached]` : "");
      if (displayText) {
        next.push({ id: genId(), kind: "user", text: displayText });
      }

      // Eager "Thinking…" indicator — visible before the backend's first byte.
      const thinkId = genId();
      thinkIdRef.current = thinkId;
      next.push({ id: thinkId, kind: "think", text: "" });

      commit(next);
      setFollowTimeline(true);
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const payload: { text: string; files?: string[] } = { text: displayText };
      if (fileIds.length > 0) payload.files = fileIds;
      streamChat(payload, onEvent, ctrl.signal)
        .finally(() => {
          if (abortRef.current !== ctrl) return;
          abortRef.current = null;
          assistantIdRef.current = null;
          thinkIdRef.current = null;
          setStreaming(false);
          // Fallback: if tool usage ran but no token came (tool-only responses,
          // or early stop) insert the work-chain end block now.
          if (workStartRef.current > 0 && !workEndedRef.current) {
            workEndedRef.current = true;
            const elapsed = Math.max(1, Math.round((Date.now() - workStartRef.current) / 1000));
            const settled = stripEmptyThink(blocksRef.current);
            commit([...settled, { id: genId(), kind: "agent-work-end", elapsed }]);
          } else {
            commit(stripEmptyThink(blocksRef.current));
          }
          workStartRef.current = 0;
          workEndedRef.current = false;
          // Persist the just-streamed blocks to the DB + cache BEFORE loadChats
          // fetches the chat list — otherwise the list may be read before the
          // save landed (SQLite write/read race) and the new chat disappears
          // from the sidebar right after the agent finishes answering.
          void persistActiveChatBlocks().finally(() => {
            refreshStatus();
            void loadChats();
          });
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") console.error("streamChat failed:", err);
        });
    },
    [
      streaming,
      connected,
      commit,
      genId,
      onEvent,
      refreshStatus,
      loadChats,
      blocksRef,
      stripEmptyThink,
      setFollowTimeline,
      persistActiveChatBlocks,
    ],
  );

  const handleStop = useCallback(() => {
    const wasStreaming = abortRef.current !== null;
    abortRef.current?.abort();
    abortRef.current = null;
    assistantIdRef.current = null;
    thinkIdRef.current = null;
    setStreaming(false);
    setConfirmReq(null);
    setQuestionReq(null);
    // The stream's finally bails out once abortRef is cleared, so settle any
    // dangling empty "Thinking…" indicator here. If tool usage was in progress,
    // close the work-chain so the collapsed summary shows after stopping.
    if (workStartRef.current > 0 && !workEndedRef.current) {
      workEndedRef.current = true;
      const elapsed = Math.max(1, Math.round((Date.now() - workStartRef.current) / 1000));
      const settled = stripEmptyThink(blocksRef.current);
      commit([...settled, { id: genId(), kind: "agent-work-end", elapsed }]);
    } else {
      commit(stripEmptyThink(blocksRef.current));
    }
    workStartRef.current = 0;
    workEndedRef.current = false;
    // The finally also skips loadChats (same guard), so a chat that was just
    // created via the first message would never appear in the sidebar until the
    // next manual refresh. Persist + reload here to keep the sidebar in sync —
    // await the persist so loadChats reads the DB after the save landed.
    if (wasStreaming) {
      void persistActiveChatBlocks().finally(() => void loadChats());
    }
  }, [commit, blocksRef, stripEmptyThink, persistActiveChatBlocks, loadChats, genId]);

  const handleConfirm = useCallback(
    async (ok: boolean) => {
      const req = confirmReq;
      try {
        if (req) await api.confirm(req.id, ok);
        setConfirmReq(null);
      } catch {
        // keep modal open so the user can retry or cancel
      }
    },
    [confirmReq],
  );

  const handleAnswer = useCallback(
    async (answers: string[][]) => {
      const req = questionReq;
      try {
        if (req) await api.answerQuestion(req.id, answers);
        setQuestionReq(null);
      } catch {
        // keep modal open so the user can retry or cancel
      }
    },
    [questionReq],
  );

  return {
    streaming,
    confirmReq,
    questionReq,
    onEvent,
    handleSend,
    handleStop,
    handleConfirm,
    handleAnswer,
  };
}
