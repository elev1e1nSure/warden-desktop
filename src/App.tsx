import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { type CSSProperties, type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { loadConnection } from "./api/session";
import { streamChat } from "./api/stream";
import type { ChatEvent, ConfirmEvent, QuestionEvent, StatusResult } from "./api/types";
import ConfirmModal from "./components/ConfirmModal";
import ConnectModal from "./components/ConnectModal";
import InputBar, { type AttachedFile } from "./components/InputBar";
import QuestionModal from "./components/QuestionModal";
import Sidebar from "./components/Sidebar";
import SkillsView from "./components/SkillsView";
import StatusBar from "./components/StatusBar";
import Timeline from "./components/Timeline";
import Toaster from "./components/Toaster";
import { headingPop } from "./motion";
import type { Block, Chat } from "./types";

type AppView = "chat" | "skills";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(272);
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
  const assistantIdRef = useRef<string | null>(null);
  const thinkIdRef = useRef<string | null>(null);
  const toolIdRef = useRef<string | null>(null);
  // Holds the model the user just picked while the /model/set call is still
  // in flight, so a stale /status response can't flash the old model back.
  const pendingModelRef = useRef<string | null>(null);

  const connected = Boolean(status?.connected);
  const hasBlocks = blocks.length > 0;

  const commit = (next: Block[]) => {
    blocksRef.current = next;
    setBlocks(next);
  };
  const genId = () => `b${++idRef.current}`;

  const loadModels = useCallback(async () => {
    try {
      const res = await api.listModels();
      setModels(res.models ?? []);
    } catch {
      setModels([]);
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
    if (!activeChatId) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    const id = activeChatId;
    const snapshot = blocks;
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void api.saveChatBlocks(id, snapshot).catch(() => {});
    }, 300);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [activeChatId, blocks]);

  const flushActiveChatBlocks = useCallback(async () => {
    const id = activeChatId;
    if (!id) return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    await api.saveChatBlocks(id, blocksRef.current);
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
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const sync = async () => {
          if (cancelled) return;
          const [fs, mx] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
          if (!cancelled) setWindowSpansFull(fs || mx);
        };
        await sync();
        const u1 = await win.listen("tauri://enter-fullscreen", () => {
          if (!cancelled) setWindowSpansFull(true);
        });
        const u2 = await win.listen("tauri://leave-fullscreen", () => {
          if (cancelled) return;
          // leave-fullscreen doesn't tell us if we then sit maximised
          void win.isMaximized().then((mx) => {
            if (!cancelled) setWindowSpansFull(mx);
          });
        });
        const u3 = await win.listen("tauri://maximize", () => {
          if (!cancelled) setWindowSpansFull(true);
        });
        const u4 = await win.listen("tauri://unmaximize", () => {
          if (cancelled) return;
          void win.isFullscreen().then((fs) => {
            if (!cancelled) setWindowSpansFull(fs);
          });
        });
        unlisten = () => {
          u1();
          u2();
          u3();
          u4();
        };
      } catch {
        // not running inside Tauri (e.g. plain `vite dev`) — keep default
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Wait for the backend to come up, then load status.
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        await loadModels();
        if (s.model) return;
      }
      // Auto-reconnect with the last used credentials so a model never has to
      // be picked on launch. No modal is forced — connect via the status bar.
      const saved = loadConnection();
      if (saved) {
        try {
          const r = await api.connect(saved.apiKey);
          if (!cancelled && r.ok) {
            await refreshStatus();
            await loadModels();
            await loadChats();
          }
        } catch {
          // ignore — user can connect manually
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus, loadModels, loadChats]);

  const appendText = (
    slot: React.MutableRefObject<string | null>,
    kind: "assistant" | "think",
    text: string,
  ) => {
    const cur = slot.current;
    const list = blocksRef.current;
    if (cur) {
      commit(
        list.map((b) => (b.id === cur && b.kind === kind ? { ...b, text: b.text + text } : b)),
      );
    } else {
      const id = genId();
      slot.current = id;
      if (kind === "assistant") {
        commit([...list, { id, kind, text }]);
      } else {
        commit([...list, { id, kind, text }]);
      }
    }
  };

  const onEvent = (e: ChatEvent) => {
    switch (e.type) {
      case "warden_start":
        assistantIdRef.current = null;
        thinkIdRef.current = null;
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
        appendText(assistantIdRef, "assistant", e.text);
        break;
      case "think": {
        const cur = thinkIdRef.current;
        const list = blocksRef.current;
        if (cur) {
          commit(
            list.map((b) =>
              b.id === cur && b.kind === "think" ? { ...b, text: b.text + e.text } : b,
            ),
          );
        } else {
          const id = genId();
          thinkIdRef.current = id;
          const assistantId = assistantIdRef.current;
          if (assistantId) {
            const idx = list.findIndex((b) => b.id === assistantId);
            const next = [...list];
            next.splice(idx, 0, { id, kind: "think", text: e.text });
            commit(next);
          } else {
            commit([...list, { id, kind: "think", text: e.text }]);
          }
        }
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
  };

  const handleSend = async (text: string, files: AttachedFile[]) => {
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

    commit(next);

    setFollowTimeline(true);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const payload: { text: string; files?: string[] } = { text };
    if (fileIds.length > 0) payload.files = fileIds;
    streamChat(payload, onEvent, ctrl.signal)
      .finally(() => {
        setStreaming(false);
        abortRef.current = null;
        refreshStatus();
        loadChats();
      })
      .catch(() => {});
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setConfirmReq(null);
    setQuestionReq(null);
  };

  const handleConfirm = async (ok: boolean) => {
    const req = confirmReq;
    try {
      if (req) await api.confirm(req.id, ok);
      setConfirmReq(null);
    } catch {
      // keep modal open so the user can retry or cancel
    }
  };

  const handleAnswer = async (answers: string[][]) => {
    const req = questionReq;
    try {
      if (req) await api.answerQuestion(req.id, answers);
      setQuestionReq(null);
    } catch {
      // keep modal open so the user can retry or cancel
    }
  };

  const handleToggleMode = async () => {
    if (!status) return;
    const auto = status.mode !== "auto";
    try {
      await api.setMode(auto);
      setStatus({ ...status, mode: auto ? "auto" : "ask" });
    } catch {
      // leave the current mode visible if the backend rejects the change
    }
  };

  const handleSelectModel = async (name: string) => {
    if (!name || name === status?.model) return;
    // Reflect the choice instantly — switching should never wait on the
    // network round-trip. The in-flight model is tracked so a status refresh
    // can't clobber it before the backend confirms.
    pendingModelRef.current = name;
    setStatus((prev) => (prev ? { ...prev, model: name } : prev));
    try {
      await api.setModel(name);
    } catch {
      // Switch failed — reconcile with whatever the backend actually has.
      pendingModelRef.current = null;
      await refreshStatus();
      return;
    }
    pendingModelRef.current = null;
  };

  const handleNewChat = async () => {
    try {
      await flushActiveChatBlocks();
      handleStop();
      await api.reset();
      setActiveChatId(null);
      commit([]);
      setFollowTimeline(true);
      setGen((g) => g + 1);
      await loadChats();
    } catch {
      // keep the current chat intact if reset fails
    }
  };

  const handleSelectChat = async (id: string) => {
    if (id === activeChatId) return;
    try {
      await flushActiveChatBlocks();
      handleStop();
      const res = await api.selectChat(id);
      const blocks = res.chat.blocks ?? [];
      if (blocks.length === 0) {
        await api.deleteChat(id);
        setActiveChatId(null);
        commit([]);
        setFollowTimeline(true);
        setGen((g) => g + 1);
        await refreshStatus();
        await loadChats();
        return;
      }
      setActiveChatId(res.chat.id);
      commit(blocks);
      setFollowTimeline(true);
      setGen((g) => g + 1);
      await refreshStatus();
      await loadChats();
    } catch {
      // leave the current chat selected if the switch fails
    }
  };
  const handleRenameChat = async (id: string, title: string) => {
    if (!title.trim()) return;
    try {
      await api.renameChat(id, title.trim());
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c)));
    } catch {
      /* ignore */
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await api.deleteChat(id);
      if (id === activeChatId) {
        setActiveChatId(null);
        commit([]);
        setGen((g) => g + 1);
      }
      await loadChats();
    } catch {
      /* ignore */
    }
  };

  const handleConnected = async () => {
    try {
      setShowConnect(false);
      await refreshStatus();
      await loadModels();
      await loadChats();
    } catch {
      // reconnect modal stays closed; status refresh will retry later
    }
  };

  const handleCloseSkills = useCallback(() => setView("chat"), []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text-primary">
        <div className="flex min-h-0 flex-1 relative">
          <div
            className={
              view === "skills"
                ? "flex min-h-0 flex-1"
                : "absolute inset-0 opacity-0 pointer-events-none"
            }
          >
            <SkillsView onClose={handleCloseSkills} />
          </div>
          <div
            className={
              view === "chat"
                ? "flex min-h-0 flex-1"
                : "absolute inset-0 opacity-0 pointer-events-none"
            }
          >
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
              className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl bg-bg"
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <StatusBar
                  status={status}
                  connected={connected}
                  models={models}
                  onSelectModel={handleSelectModel}
                  onOpenConnect={() => setShowConnect(true)}
                />

                {/* Timeline */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {(hasBlocks || streaming) && (
                    <motion.div
                      key="timeline"
                      onScroll={handleTimelineScroll}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="min-h-0 flex-1 overflow-y-auto no-scrollbar"
                    >
                      <Timeline
                        blocks={blocks}
                        generation={gen}
                        thinking={
                          streaming && (blocks.length === 0 || blocks.at(-1)?.kind === "user")
                        }
                        follow={followTimeline}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input zone */}
                <motion.div
                  className={
                    hasBlocks
                      ? "shrink-0 px-6 pt-2 pb-6"
                      : "flex flex-1 flex-col items-center justify-center px-6"
                  }
                >
                  <AnimatePresence mode="popLayout">
                    {!hasBlocks && (
                      <motion.div {...headingPop} className="mb-7 select-none">
                        <div
                          style={{ transform: "translateX(var(--chat-shift, 0px))" }}
                          className="text-center"
                        >
                          <h1 className="text-display font-semibold tracking-[-0.02em] text-text-primary">
                            {connected ? "Where should we begin?" : "warden"}
                          </h1>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <InputBar
                    onSend={handleSend}
                    onStop={handleStop}
                    streaming={streaming}
                    disabled={!connected || Boolean(confirmReq) || Boolean(questionReq)}
                    placeholder={connected ? "Message warden..." : "Connect a model first"}
                    auto={status?.mode === "auto"}
                    onToggleMode={connected ? handleToggleMode : undefined}
                  />
                </motion.div>
              </div>
            </main>
          </div>
        </div>

        <AnimatePresence>
          {confirmReq && <ConfirmModal request={confirmReq} onResolve={handleConfirm} />}
        </AnimatePresence>
        <AnimatePresence>
          {questionReq && <QuestionModal request={questionReq} onSubmit={handleAnswer} />}
        </AnimatePresence>
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
