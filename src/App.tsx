import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  type CSSProperties,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, setAuthToken } from "./api/client";
import { loadConnection, verifyBackend } from "./api/session";
import { streamChat } from "./api/stream";
import type { ChatEvent, ConfirmEvent, QuestionEvent, StatusResult } from "./api/types";
import ConfirmModal from "./components/ConfirmModal";
import ConnectModal from "./components/ConnectModal";
import InputBar, { type AttachedFile } from "./components/InputBar";
import QuestionModal from "./components/QuestionModal";
import SettingsView from "./components/SettingsView";
import Sidebar from "./components/Sidebar";
import SkillsView from "./components/SkillsView";
import StarfieldBackdrop from "./components/StarfieldBackdrop";
import Timeline from "./components/Timeline";
import Toaster from "./components/Toaster";
import { EASE } from "./motion";
import type { Block, Chat, Model } from "./types";

type AppView = "chat" | "skills" | "settings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const SIDEBAR_WIDTH_KEY = "warden.sidebarWidth";
const loadSidebarWidth = (): number => {
  const raw = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return Number.isFinite(raw) && raw >= 180 && raw <= 400 ? raw : 272;
};

const WELCOME_PHRASES = [
  "Where should we begin?",
  "What shall we build today?",
  "Ready to orchestrate some tasks?",
  "Let's automate the routine.",
  "What's on the horizon?",
];

const cleanLLMTokens = (str: string): string => {
  return str.replace(
    /<\|eom\|>|<\|eot_id\|>|<\|eom_id\|>|<\|im_end\|>|<\|im_start\|>|<\|end_of_text\|>|<\|endoftext\|>|<\/s>|<s>|<pad>/gi,
    "",
  );
};

// Reasoning blocks are opened eagerly (as the live "Thinking…" indicator) and
// stay empty on iterations where the model emits no reasoning. Drop those before
// they reach state we persist or render long-term — they carry nothing.
const stripEmptyThink = (blocks: Block[]): Block[] =>
  blocks.filter((b) => b.kind !== "think" || b.text.trim().length > 0);

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmEvent | null>(null);
  const [questionReq, setQuestionReq] = useState<QuestionEvent | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [gen, setGen] = useState(0);
  const [view, setView] = useState<AppView>("chat");
  const [followTimeline, setFollowTimeline] = useState(true);
  const [windowSpansFull, setWindowSpansFull] = useState(false);

  // blocksRef mirrors state so event handlers stay pure (StrictMode-safe).
  const blocksRef = useRef<Block[]>([]);
  const idRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  // True when blocks have been modified by user actions and need to be saved.
  // False after loading blocks from DB or resetting — prevents startup from
  // wiping saved blocks by writing an empty array before content is loaded.
  const blocksDirtyRef = useRef(false);
  const assistantIdRef = useRef<string | null>(null);
  const thinkIdRef = useRef<string | null>(null);
  const toolIdRef = useRef<string | null>(null);
  // Holds the model the user just picked while the /model/set call is still
  // in flight, so a stale /status response can't flash the old model back.
  const pendingModelRef = useRef<string | null>(null);

  const connected = Boolean(status?.connected);
  const hasBlocks = blocks.length > 0;
  // Empty state = the welcome screen with the input centred. The moment any
  // message exists or a turn is streaming, we switch to the conversation layout.
  const emptyState = !(hasBlocks || streaming);

  const welcomePhrase = useMemo(() => {
    const idx = Math.floor(Math.random() * WELCOME_PHRASES.length);
    return WELCOME_PHRASES[idx] ?? WELCOME_PHRASES[0];
  }, []);

  const modelList: Model[] = useMemo(
    () =>
      models.map((m) => ({
        id: m,
        name: m,
        description: "",
      })),
    [models],
  );

  const selectedModel: Model = useMemo(
    () => ({
      id: status?.model ?? "",
      name: status?.model || "No model",
      description: "",
    }),
    [status?.model],
  );

  // commit: marks blocks as dirty (needs saving). Use for user actions / stream events.
  const commit = useCallback((next: Block[]) => {
    blocksDirtyRef.current = true;
    blocksRef.current = next;
    setBlocks(next);
  }, []);
  // loadBlocks: replaces blocks WITHOUT marking dirty. Use when loading from DB.
  const loadBlocks = useCallback((next: Block[]) => {
    blocksDirtyRef.current = false;
    blocksRef.current = next;
    setBlocks(next);
  }, []);
  const genId = useCallback(() => `b${++idRef.current}`, []);

  // Persist the sidebar width so it survives restarts.
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // storage unavailable — non-fatal
    }
  }, [sidebarWidth]);

  const loadModels = useCallback(async () => {
    try {
      const res = await api.listModels();
      const list = res.models ?? [];
      setModels(list);
      return list;
    } catch {
      setModels([]);
      return [];
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus((prev) => {
        // A model switch is still being confirmed by the backend — keep the
        // user's choice instead of momentarily flashing the previous model.
        if (pendingModelRef.current && s.model !== pendingModelRef.current) {
          return prev ? { ...s, model: prev.model } : s;
        }
        return s;
      });
      return s;
    } catch {
      return null;
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const res = await api.listChats();
      setChats(res.chats.map((chat) => ({ ...chat, messages: [] })));
      setActiveChatId((cur) =>
        cur && res.chats.some((chat) => chat.id === cur)
          ? cur
          : res.chats.some((chat) => chat.id === res.active_chat_id)
            ? res.active_chat_id
            : null,
      );
      return res;
    } catch {
      setChats([]);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activeChatId || !blocksDirtyRef.current) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    const id = activeChatId;
    const snapshot = stripEmptyThink(blocks);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      blocksDirtyRef.current = false;
      void api.saveChatBlocks(id, snapshot).catch((err) => {
        if (process.env.NODE_ENV !== "production") console.error("saveChatBlocks failed:", err);
      });
    }, 300);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [activeChatId, blocks]);

  const flushActiveChatBlocks = useCallback(async () => {
    const id = activeChatId;
    if (!id || !blocksDirtyRef.current) return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    blocksDirtyRef.current = false;
    await api.saveChatBlocks(id, stripEmptyThink(blocksRef.current));
  }, [activeChatId]);

  const handleTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollowTimeline(nearBottom);
  }, []);

  // When the window is maximised or fullscreen, the chrome (sidebar) becomes a
  // small fraction of the screen. Centering the empty-state heading and the
  // input bar inside `main` then looks visually off-center relative to the
  // app. Shift them left by half the sidebar width so they sit at the
  // window's true centre. Plain floating windows stay centred inside `main`.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let timeoutId: number | undefined;

    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const sync = async () => {
          if (cancelled) return;
          try {
            const [fs, mx] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
            if (!cancelled) setWindowSpansFull(fs || mx);
          } catch {
            // not running inside Tauri or window API failed — keep default
          }
        };

        const debouncedSync = () => {
          if (timeoutId) window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(sync, 150);
        };

        await sync();
        if (cancelled) return;

        const u1 = await win.listen("tauri://enter-fullscreen", debouncedSync);
        if (cancelled) return;
        const u2 = await win.listen("tauri://leave-fullscreen", debouncedSync);
        if (cancelled) return;
        const u3 = await win.listen("tauri://maximize", debouncedSync);
        if (cancelled) return;
        const u4 = await win.listen("tauri://unmaximize", debouncedSync);
        if (cancelled) return;
        const u5 = await win.listen("tauri://resize", debouncedSync);

        window.addEventListener("resize", debouncedSync);

        unlisten = () => {
          u1();
          u2();
          u3();
          u4();
          u5();
          window.removeEventListener("resize", debouncedSync);
        };
      } catch {
        // not running inside Tauri (e.g. plain `vite dev`) — keep default
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      unlisten?.();
    };
  }, []);

  // Wait for the backend to come up, then load status.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Try to fetch the shared secret token from the Tauri shell.
      //    In dev (without Tauri) this will fail silently.
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const token = await invoke<string>("get_backend_token");
        if (token) setAuthToken(token);
      } catch {
        // Not running inside Tauri or token not available — dev mode, WARDEN_DEV=1
      }

      for (let i = 0; i < 90; i++) {
        if (cancelled) return;
        if (await api.health()) break;
        await sleep(1000);
      }
      if (cancelled) return;
      const s = await refreshStatus();
      await loadChats();
      if (cancelled || !s) return;
      if (s.connected) {
        const list = await loadModels();
        const savedModel = localStorage.getItem("warden.lastModel");
        if (savedModel && list.includes(savedModel) && s.model !== savedModel) {
          try {
            await api.setModel(savedModel);
            await refreshStatus();
          } catch {
            // ignore
          }
        }
      } else {
        // Auto-reconnect with the last used credentials so a model never has to
        // be picked on launch. No modal is forced — connect via the status bar.
        const saved = loadConnection();
        if (saved) {
          try {
            // Verify the backend is our own Warden instance before sending the
            // API key — protects against a rogue process listening on :8765.
            const ok = await verifyBackend();
            if (!ok) return;
            const r = await api.connect(saved.apiKey);
            if (!cancelled && r.ok) {
              await refreshStatus();
              const list = await loadModels();
              const savedModel = localStorage.getItem("warden.lastModel");
              if (savedModel && list.includes(savedModel)) {
                try {
                  await api.setModel(savedModel);
                  await refreshStatus();
                } catch {
                  // ignore
                }
              }
              await loadChats();
            }
          } catch {
            // ignore — user can connect manually
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus, loadModels, loadChats]);

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
    [commit, genId],
  );

  // Opens a fresh, empty reasoning block at the end of the timeline and points
  // thinkIdRef at it. This block IS the "Thinking…" indicator; think tokens fill
  // it and it settles into a "Thought" once the agent moves on. Empty ones are
  // stripped before persisting (stripEmptyThink).
  const openThink = useCallback(() => {
    const id = genId();
    thinkIdRef.current = id;
    commit([...blocksRef.current, { id, kind: "think", text: "" }]);
  }, [commit, genId]);

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
              return [{ id: e.chat_id, title: e.title, timestamp, messages: [] }, ...prev];
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
    [appendText, commit, genId, openThink],
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
    [streaming, connected, commit, genId, onEvent, refreshStatus, loadChats],
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
  }, [commit]);

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

  const handleToggleMode = useCallback(async () => {
    if (!status) return;
    const auto = status.mode !== "auto";
    try {
      await api.setMode(auto);
      setStatus({ ...status, mode: auto ? "auto" : "ask" });
    } catch {
      // leave the current mode visible if the backend rejects the change
    }
  }, [status]);

  const handleSelectModel = useCallback(
    async (name: string) => {
      if (!name || name === status?.model) return;
      // Reflect the choice instantly — switching should never wait on the
      // network round-trip. The in-flight model is tracked so a status refresh
      // can't clobber it before the backend confirms.
      pendingModelRef.current = name;
      setStatus((prev) => (prev ? { ...prev, model: name } : prev));
      try {
        await api.setModel(name);
        localStorage.setItem("warden.lastModel", name);
      } catch {
        // Switch failed — reconcile with whatever the backend actually has.
        pendingModelRef.current = null;
        await refreshStatus();
        return;
      }
      pendingModelRef.current = null;
    },
    [status, refreshStatus],
  );

  const handleNewChat = useCallback(async () => {
    try {
      await flushActiveChatBlocks();
      handleStop();
      await api.reset();
      setActiveChatId(null);
      loadBlocks([]);
      setFollowTimeline(true);
      setGen((g) => g + 1);
      await loadChats();
    } catch {
      // keep the current chat intact if reset fails
    }
  }, [flushActiveChatBlocks, handleStop, loadBlocks, loadChats]);

  const handleSelectChat = useCallback(
    async (id: string) => {
      if (id === activeChatId) return;
      try {
        await flushActiveChatBlocks();
        handleStop();
        const res = await api.selectChat(id);
        const blocks = res.chat.blocks ?? [];
        setActiveChatId(res.chat.id);
        loadBlocks(blocks);
        setFollowTimeline(true);
        setGen((g) => g + 1);
        await refreshStatus();
        await loadChats();
      } catch {
        // leave the current chat selected if the switch fails
      }
    },
    [activeChatId, flushActiveChatBlocks, handleStop, loadBlocks, refreshStatus, loadChats],
  );

  const handleRenameChat = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    try {
      await api.renameChat(id, title.trim());
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c)));
    } catch {
      /* ignore */
    }
  }, []);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        await api.deleteChat(id);
        if (id === activeChatId) {
          setActiveChatId(null);
          loadBlocks([]);
          setGen((g) => g + 1);
        }
        await loadChats();
      } catch {
        /* ignore */
      }
    },
    [activeChatId, loadBlocks, loadChats],
  );

  const handleConnected = useCallback(async () => {
    try {
      setShowConnect(false);
      await refreshStatus();
      const list = await loadModels();
      const savedModel = localStorage.getItem("warden.lastModel");
      if (savedModel && list.includes(savedModel)) {
        try {
          await api.setModel(savedModel);
          await refreshStatus();
        } catch {
          // ignore
        }
      }
      await loadChats();
    } catch {
      // reconnect modal stays closed; status refresh will retry later
    }
  }, [refreshStatus, loadModels, loadChats]);

  const handleCloseSkills = useCallback(() => setView("chat"), []);
  const handleCloseSettings = useCallback(() => setView("chat"), []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll timeline when content changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: blocks and streaming are triggers for scroll height recalculation
  useEffect(() => {
    if (!followTimeline) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [blocks, streaming, followTimeline]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-text-primary">
        <div className="flex min-h-0 flex-1 relative">
          <div
            className={
              view === "skills"
                ? "flex min-h-0 flex-1"
                : "absolute inset-0 opacity-0 pointer-events-none"
            }
          >
            <SkillsView
              onClose={handleCloseSkills}
              sidebarWidth={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
            />
          </div>
          <div
            className={
              view === "settings"
                ? "flex min-h-0 flex-1"
                : "absolute inset-0 opacity-0 pointer-events-none"
            }
          >
            <SettingsView
              onClose={handleCloseSettings}
              status={status}
              connected={connected}
              models={models}
              onSelectModel={handleSelectModel}
              onToggleMode={handleToggleMode}
              onOpenSkills={() => setView("skills")}
              sidebarWidth={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
            />
          </div>
          <div
            className={
              view === "chat"
                ? "relative overflow-hidden flex min-h-0 flex-1"
                : "absolute inset-0 opacity-0 pointer-events-none"
            }
          >
            {/* Ambient orbs at layout level so they show through the glass sidebar */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full ambient-orb-1" />
              <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full ambient-orb-2" />
              <div className="absolute top-[30%] left-[50%] w-[50%] h-[50%] rounded-full ambient-orb-3" />
            </div>
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              width={sidebarWidth}
              skillsActive={false}
              onSelectChat={(id) => {
                setView("chat");
                void handleSelectChat(id);
              }}
              onNewChat={() => {
                setView("chat");
                void handleNewChat();
              }}
              onOpenSkills={() => setView((v) => (v === "skills" ? "chat" : "skills"))}
              onOpenSettings={() => setView("settings")}
              onRenameChat={(id, title) => {
                void handleRenameChat(id, title);
              }}
              onDeleteChat={(id) => {
                void handleDeleteChat(id);
              }}
            />

            {/* Resize handle — sits on top of main's border-l */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only drag handle; keyboard a11y would require full slider widget */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = sidebarWidth;
                const onMove = (ev: MouseEvent) =>
                  setSidebarWidth(Math.min(400, Math.max(180, startW + ev.clientX - startX)));
                const onUp = () => {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
              className="relative z-10 w-0 shrink-0 cursor-col-resize"
            >
              <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>

            <main
              style={
                {
                  "--chat-shift": windowSpansFull ? `${-(sidebarWidth / 2)}px` : "0px",
                } as CSSProperties
              }
              className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl"
            >
              {/* Chat surface. The input bar is a single element that travels
                  between centre (empty state) and bottom (conversation) via a
                  layout="position" animation, so opening a new chat and sending
                  the first message use the exact same motion. The timeline,
                  starfield, welcome heading and bottom scrim cross-fade around it. */}
              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Empty-state starfield */}
                <AnimatePresence>
                  {emptyState && (
                    <motion.div
                      key="starfield"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="absolute inset-0 z-0"
                    >
                      <StarfieldBackdrop />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Timeline */}
                <AnimatePresence>
                  {!emptyState && (
                    <motion.div
                      key="timeline"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      ref={scrollContainerRef}
                      onScroll={handleTimelineScroll}
                      className="min-h-0 flex-1 overflow-y-auto no-scrollbar"
                    >
                      {/* Switching chats swaps the whole conversation as one unit
                          (keyed by generation) rather than letting every block
                          reconcile and re-animate — that per-block churn was the
                          jank. Empty↔chat is handled by the outer layer above and
                          left untouched. */}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={gen}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.08, ease: "linear" }}
                        >
                          <Timeline blocks={blocks} generation={gen} streaming={streaming} />
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom scrim so messages fade out under the floating input */}
                <AnimatePresence>
                  {!emptyState && (
                    <motion.div
                      key="scrim"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-bg via-bg/95 to-transparent"
                    />
                  )}
                </AnimatePresence>

                {/* Overlay holding the welcome heading + input. The input's
                    vertical position is driven purely by two flex spacers: equal
                    weight centres it (empty state), collapsing the bottom one
                    drops it to the bottom (conversation). Because the motion is
                    state-driven, not layout-measured, sidebar resizing never
                    disturbs it — only the empty↔conversation switch animates. */}
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center px-6">
                  <div className="w-full flex-1" />

                  <AnimatePresence>
                    {emptyState && (
                      <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="relative mb-7 select-none"
                      >
                        <div
                          style={{ transform: "translateX(var(--chat-shift, 0px))" }}
                          className="text-center"
                        >
                          <h1 className="text-display font-semibold tracking-[-0.02em] text-text-primary">
                            {connected ? welcomePhrase : "warden"}
                          </h1>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pointer-events-auto w-full max-w-3xl">
                    <AnimatePresence mode="wait">
                      {confirmReq ? (
                        <ConfirmModal
                          key="confirm"
                          request={confirmReq}
                          onResolve={handleConfirm}
                        />
                      ) : questionReq ? (
                        <QuestionModal
                          key="question"
                          request={questionReq}
                          onSubmit={handleAnswer}
                        />
                      ) : (
                        <InputBar
                          key="input"
                          onSend={handleSend}
                          onStop={handleStop}
                          streaming={streaming}
                          disabled={!connected}
                          placeholder={connected ? "Message warden..." : "Connect a model first"}
                          auto={status?.mode === "auto"}
                          onToggleMode={connected ? handleToggleMode : undefined}
                          models={modelList}
                          selectedModel={selectedModel}
                          onSelectModel={handleSelectModel}
                          connected={connected}
                          onOpenConnect={() => setShowConnect(true)}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.div
                    className="w-full shrink-0"
                    style={{ minHeight: 24 }}
                    initial={false}
                    animate={{ flexGrow: emptyState ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>

        <AnimatePresence>
          {showConnect && (
            <ConnectModal
              onConnected={handleConnected}
              onClose={connected ? () => setShowConnect(false) : undefined}
            />
          )}
        </AnimatePresence>
        <Toaster />
      </div>
    </MotionConfig>
  );
}

export default App;
