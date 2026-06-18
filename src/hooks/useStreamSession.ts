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
}: UseStreamSessionParams): UseStreamSessionResult {
  const [streaming, setStreaming] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmEvent | null>(null);
  const [questionReq, setQuestionReq] = useState<QuestionEvent | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const thinkIdRef = useRef<string | null>(null);
  const toolIdRef = useRef<string | null>(null);

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
          assistantIdRef.current = null;
          if (thinkIdRef.current === null) openThink();
          break;
        case "title":
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
    [appendText, commit, genId, openThink, blocksRef, setActiveChatId, setChats],
  );

  const handleSend = useCallback(
    async (text: string, files: AttachedFile[]) => {
      if (streaming || !connected) return;
      assistantIdRef.current = null;
      thinkIdRef.current = null;
      toolIdRef.current = null;

      let fileIds: string[] = [];
      let uploadFailed = false;
      if (files.length > 0) {
        try {
          const results = await Promise.all(files.map((f) => api.uploadFile(f.file)));
          fileIds = results.filter(Boolean);
        } catch {
          uploadFailed = true;
        }
      }

      if (uploadFailed && !text) {
        commit([
          ...blocksRef.current,
          {
            id: genId(),
            kind: "error",
            text: "File upload failed; nothing was sent.",
          },
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

      if (text || next.length === blocksRef.current.length) {
        const displayText = text || (files.length > 0 ? `[${files.length} file(s) attached]` : "");
        if (displayText) {
          next.push({ id: genId(), kind: "user", text: displayText });
        }
      }

      // Open the live "Thinking…" indicator immediately so the very first moment
      // after send shows activity, before the backend's first byte arrives. The
      // first warden_start reuses this slot instead of opening another.
      const thinkId = genId();
      thinkIdRef.current = thinkId;
      next.push({ id: thinkId, kind: "think", text: "" });

      commit(next);

      setFollowTimeline(true);
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const payload: { text: string; files?: string[] } = { text };
      if (fileIds.length > 0) payload.files = fileIds;
      streamChat(payload, onEvent, ctrl.signal)
        .finally(() => {
          // Guard against race: if a new stream was started while this one was
          // finishing, `abortRef.current` will point to the new controller.
          if (abortRef.current !== ctrl) return;
          abortRef.current = null;
          assistantIdRef.current = null;
          thinkIdRef.current = null;
          setStreaming(false);
          commit(stripEmptyThink(blocksRef.current));
          refreshStatus();
          loadChats();
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
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    assistantIdRef.current = null;
    thinkIdRef.current = null;
    setStreaming(false);
    setConfirmReq(null);
    setQuestionReq(null);
    // The stream's finally bails out once abortRef is cleared, so settle any
    // dangling empty "Thinking…" indicator here.
    commit(stripEmptyThink(blocksRef.current));
  }, [commit, blocksRef, stripEmptyThink]);

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
