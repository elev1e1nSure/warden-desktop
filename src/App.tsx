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
import type { StatusResult } from "./api/types";
import ConfirmModal from "./components/ConfirmModal";
import ConnectModal from "./components/ConnectModal";
import InputBar from "./components/InputBar";
import QuestionModal from "./components/QuestionModal";
import SettingsView from "./components/SettingsView";
import Sidebar from "./components/Sidebar";
import SkillsView from "./components/SkillsView";
import StarfieldBackdrop from "./components/StarfieldBackdrop";
import Timeline from "./components/Timeline";
import Toaster from "./components/Toaster";
import { useBlocks } from "./hooks/useBlocks";
import { useStreamSession } from "./hooks/useStreamSession";
import { useUpdater } from "./hooks/useUpdater";
import { useWindowSpansFull } from "./hooks/useWindowSpansFull";
import { EASE } from "./motion";
import type { Chat, Model } from "./types";

type AppView = "chat" | "skills" | "settings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [gen, setGen] = useState(0);
  const [view, setView] = useState<AppView>("chat");
  const [followTimeline, setFollowTimeline] = useState(true);
  const windowSpansFull = useWindowSpansFull();

  // Holds the model the user just picked while the /model/set call is still
  // in flight, so a stale /status response can't flash the old model back.
  const pendingModelRef = useRef<string | null>(null);

  const { blocks, blocksRef, commit, loadBlocks, genId, flushActiveChatBlocks, stripEmptyThink } =
    useBlocks(activeChatId);

  const connected = Boolean(status?.connected);
  const hasBlocks = blocks.length > 0;

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

  const handleTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollowTimeline(nearBottom);
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

      // Read the auth token only after the backend is up — the .token file
      // is written by the backend on startup, so it doesn't exist before that.
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const token = await invoke<string>("get_backend_token");
        if (token) setAuthToken(token);
      } catch {
        // Not running inside Tauri or token not available — dev mode, WARDEN_DEV=1
      }

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

  useUpdater();

  const {
    streaming,
    confirmReq,
    questionReq,
    handleSend,
    handleStop,
    handleConfirm,
    handleAnswer,
  } = useStreamSession({
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
  });

  // Empty state = the welcome screen with the input centred. The moment any
  // message exists or a turn is streaming, we switch to the conversation layout.
  const emptyState = !(hasBlocks || streaming);

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
          <motion.div
            animate={{
              opacity: view === "skills" ? 1 : 0,
              scale: view === "skills" ? 1 : 0.98,
            }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ pointerEvents: view === "skills" ? "auto" : "none" }}
            className="absolute inset-0 flex overflow-hidden"
          >
            <SkillsView
              onClose={handleCloseSkills}
              ready={connected}
              sidebarWidth={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
            />
          </motion.div>
          <motion.div
            animate={{
              opacity: view === "settings" ? 1 : 0,
              scale: view === "settings" ? 1 : 0.98,
            }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ pointerEvents: view === "settings" ? "auto" : "none" }}
            className="absolute inset-0 flex overflow-hidden"
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
          </motion.div>
          <motion.div
            animate={{
              opacity: view === "chat" ? 1 : 0,
              scale: view === "chat" ? 1 : 0.98,
            }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ pointerEvents: view === "chat" ? "auto" : "none" }}
            className="absolute inset-0 flex overflow-hidden"
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
          </motion.div>
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
