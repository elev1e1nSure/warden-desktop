import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  type CSSProperties,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { api } from "./api/client";
import type { PermissionsState, StatusResult } from "./api/types";
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
import { useAppInit } from "./hooks/useAppInit";
import { useBlocks } from "./hooks/useBlocks";
import { useStreamSession } from "./hooks/useStreamSession";
import { useUpdater } from "./hooks/useUpdater";
import { useWindowSpansFull } from "./hooks/useWindowSpansFull";
import { EASE } from "./motion";
import type { Block, Chat, Model } from "./types";

type AppView = "chat" | "skills" | "settings";

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
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);
  const [followTimeline, setFollowTimeline] = useState(true);
  const windowSpansFull = useWindowSpansFull();

  // Holds the model the user just picked while the /model/set call is still
  // in flight, so a stale /status response can't flash the old model back.
  const pendingModelRef = useRef<string | null>(null);

  // Per-chat block cache. Re-opening a conversation renders from here instantly
  // instead of waiting on the backend round-trip (that wait was the switch lag);
  // the backend select still runs in the background to swap the active session.
  const chatBlocksCacheRef = useRef<Map<string, Block[]>>(new Map());
  // Latest activeChatId for async reconciliation — so a select that resolves
  // after the user has already moved on doesn't overwrite the new chat.
  const activeChatIdRef = useRef<string | null>(null);
  // Latest chats for async reconciliation — loadChats reads this to merge the
  // active chat back in if the backend list lags behind the title event.
  const chatsRef = useRef<Chat[]>([]);
  // Tracks chat IDs currently being prefetched in the background to avoid duplicate requests.
  const prefetchingIdsRef = useRef<Set<string>>(new Set());

  const { blocks, blocksRef, commit, loadBlocks, genId, flushActiveChatBlocks, stripEmptyThink } =
    useBlocks(activeChatId);

  const connected = Boolean(status?.connected);

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

  // Keep the ref in sync for async reconciliation after a chat switch.
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Keep chatsRef in sync so async loadChats can read the latest chats state
  // (e.g. the chat added by the title event) without a stale closure.
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

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

  const prefetchChats = useCallback(async (chatIds: string[], skipId?: string | null) => {
    await Promise.all(
      chatIds.map(async (id) => {
        if (id === skipId) return;
        if (chatBlocksCacheRef.current.has(id) || prefetchingIdsRef.current.has(id)) {
          return;
        }
        prefetchingIdsRef.current.add(id);
        try {
          const res = await api.getChat(id);
          const next = res.chat.blocks ?? [];
          chatBlocksCacheRef.current.set(id, next);
        } catch (err) {
          console.error(`Failed to prefetch chat ${id}:`, err);
        } finally {
          prefetchingIdsRef.current.delete(id);
        }
      }),
    );
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const res = await api.listChats();
      const incoming = res.chats.map((chat) => ({ ...chat, messages: [] }));
      const activeId = activeChatIdRef.current;
      // If the active chat (e.g. the one just created via the first message's
      // title event) isn't in the backend's list yet — history save still in
      // flight, or list_chats filtered it — keep it in the sidebar so it
      // doesn't vanish right after the agent finishes answering. We merge it
      // in from the existing chats state to preserve the title we already have.
      if (activeId && !incoming.some((c) => c.id === activeId)) {
        const known = chatsRef.current.find((c) => c.id === activeId);
        if (known) incoming.unshift(known as (typeof incoming)[number]);
      }
      setChats(incoming);
      setActiveChatId(
        activeId && incoming.some((chat) => chat.id === activeId)
          ? activeId
          : incoming.some((chat) => chat.id === res.active_chat_id)
            ? res.active_chat_id
            : null,
      );
      // The active chat's blocks may still be in flight to the DB (debounced
      // save). Don't prefetch it from the DB — that would cache stale/empty
      // blocks. Cache it from the live blocksRef instead so a quick switch
      // back renders the right content.
      const chatIds = incoming.map((chat) => chat.id);
      void prefetchChats(chatIds, activeId);
      if (activeId && !chatBlocksCacheRef.current.has(activeId)) {
        chatBlocksCacheRef.current.set(activeId, blocksRef.current);
      }
      return res;
    } catch (err) {
      // Don't wipe the sidebar on a transient listChats failure (e.g. a
      // SQLite write/read race while saveChatBlocks is in flight) — that was
      // making the just-finished chat vanish from the sidebar. Keep the
      // existing chat list and let the next successful call refresh it.
      if (process.env.NODE_ENV !== "production") console.error("loadChats failed:", err);
      return null;
    }
  }, [prefetchChats, blocksRef]);

  const handleTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollowTimeline(nearBottom);
  }, []);

  // Persist the active chat's blocks to the DB and the in-memory cache. Uses
  // activeChatIdRef (kept in sync synchronously in the stream's title event)
  // so it works even before React has re-rendered with the new id — that's the
  // window between the first message's title event and the stream's finally.
  // Returns the save promise so callers can await it before issuing loadChats,
  // avoiding a race where listChats reads the DB before saveChatBlocks landed
  // and returns a chat list missing the just-created conversation.
  const persistActiveChatBlocks = useCallback(async () => {
    const id = activeChatIdRef.current;
    if (!id) return;
    chatBlocksCacheRef.current.set(id, blocksRef.current);
    await flushActiveChatBlocks(id).catch(() => {});
  }, [blocksRef, flushActiveChatBlocks]);

  useAppInit({ refreshStatus, loadModels, loadChats });
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
    persistActiveChatBlocks,
    activeChatIdRef,
    setFollowTimeline,
    setActiveChatId,
    setChats,
  });

  // Empty state = the welcome screen with the input centred. The moment any
  // message exists or a turn is streaming, we switch to the conversation layout.
  const emptyState = activeChatId === null && blocks.length === 0 && !streaming;

  const handleSetMode = useCallback(
    async (mode: "ask" | "auto" | "custom") => {
      if (!status) return;
      try {
        await api.setMode(mode);
        setStatus({ ...status, mode });
      } catch {
        // leave the current mode visible if the backend rejects the change
      }
    },
    [status],
  );

  const handleToggleMode = useCallback(async () => {
    await handleSetMode(status?.mode === "auto" ? "ask" : "auto");
  }, [status, handleSetMode]);

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
      handleStop();

      // Snapshot the chat we're leaving so coming back to it is instant.
      const outgoingId = activeChatIdRef.current;
      if (outgoingId) chatBlocksCacheRef.current.set(outgoingId, blocksRef.current);

      // Flush the outgoing chat's blocks BEFORE clearing the UI — loadBlocks([])
      // resets blocksDirtyRef and blocksRef, which would turn the flush into a
      // no-op and lose the conversation. Fire-and-forget so the empty state
      // still shows instantly; the save races ahead of /reset without blocking.
      void flushActiveChatBlocks();

      // Optimistically switch to empty welcome layout instantly
      activeChatIdRef.current = null;
      setActiveChatId(null);
      loadBlocks([]);
      setFollowTimeline(true);
      setGen((g) => g + 1);

      // Persist the outgoing chat in the background — it must not delay the
      // empty state from showing.
      await api.reset();
      await loadChats();
    } catch {
      // keep the current chat intact if reset fails
    }
  }, [blocksRef, flushActiveChatBlocks, handleStop, loadBlocks, loadChats]);

  const handleSelectChat = useCallback(
    async (id: string) => {
      if (id === activeChatIdRef.current) return;
      handleStop();

      // Snapshot the chat we're leaving so coming back to it is instant.
      const outgoingId = activeChatIdRef.current;
      if (outgoingId) chatBlocksCacheRef.current.set(outgoingId, blocksRef.current);

      // Optimistically switch chat selection in sidebar
      activeChatIdRef.current = id;
      setActiveChatId(id);

      // Saving the outgoing chat writes to a different id than the one we're
      // loading, so it doesn't need to block the switch — fire and forget.
      void flushActiveChatBlocks().catch(() => {});

      // Render from cache immediately when we've shown this chat before — no
      // waiting on the backend. The select call below still runs to swap the
      // active session, but the conversation is already on screen.
      const cached = chatBlocksCacheRef.current.get(id);
      if (cached) {
        loadBlocks(cached);
        setGen((g) => g + 1);
        setFollowTimeline(true);
      } else {
        // Clear the blocks optimistically so the previous chat's contents are not shown while loading.
        loadBlocks([]);
        setGen((g) => g + 1);
        setFollowTimeline(true);
      }

      try {
        const res = await api.selectChat(id);
        const next = res.chat.blocks ?? [];
        // Only cache the server blocks on a cache miss — on a hit the cache
        // already holds the freshest blocks (the active chat is the only one
        // that streams, and it's snapshotted into the cache on switch).
        // Overwriting with stale DB blocks (e.g. a debounced save still in
        // flight) would empty the chat on the next visit.
        if (!cached) {
          chatBlocksCacheRef.current.set(id, next);
        }
        // On a cache hit the conversation is already shown — only non-active
        // chats are cached and nothing but the active chat ever streams, so the
        // cache can't be stale. Render the server's blocks only on a cache miss,
        // and only if the user hasn't already moved to another chat.
        if (!cached && activeChatIdRef.current === id) {
          loadBlocks(next);
          setGen((g) => g + 1);
          setFollowTimeline(true);
        }
      } catch {
        // leave whatever is shown (cache) if the switch fails
      }
    },
    [flushActiveChatBlocks, handleStop, loadBlocks, blocksRef],
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
        chatBlocksCacheRef.current.delete(id);
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

  const loadPermissions = useCallback(async () => {
    try {
      const p = await api.getPermissions();
      setPermissions(p);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (connected) void loadPermissions();
    else setPermissions(null);
  }, [connected, loadPermissions]);

  const hasCustomPermissions =
    permissions !== null && Object.values(permissions).some((v) => v !== "ask");

  const handleCloseSkills = useCallback(() => setView("chat"), []);
  const handleCloseSettings = useCallback(() => {
    setView("chat");
    void loadPermissions();
  }, [loadPermissions]);

  useHotkeys("ctrl+n", () => void handleNewChat(), { preventDefault: true }, [handleNewChat]);
  useHotkeys("ctrl+shift+c", () => setShowConnect((v) => !v), { preventDefault: true }, []);
  useHotkeys("escape", () => {
    if (view !== "chat") setView("chat");
  }, [view]);

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

            {/* Resize handle — sits between sidebar and main */}
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
              className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden"
            >
              {/* Ambient orbs scoped to the content area only */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full ambient-orb-1" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full ambient-orb-2" />
                <div className="absolute top-[30%] left-[50%] w-[50%] h-[50%] rounded-full ambient-orb-3" />
              </div>
              <div className="glass-orb-overlay" aria-hidden="true" />
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
                          jank. The new conversation mounts straight away and grows
                          in from the composer with a soft scale; there is no exit
                          on the outgoing one, so there's no blank gap (the flicker)
                          between them. Empty↔chat is handled by the outer layer
                          above and left untouched. */}
                      <motion.div
                        key={gen}
                        initial={{ opacity: 0, scale: 0.975 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        style={{ transformOrigin: "50% 100%" }}
                      >
                        <Timeline
                          blocks={blocks}
                          generation={gen}
                          streaming={streaming}
                          scrollRef={scrollContainerRef}
                        />
                      </motion.div>
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
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-bg to-transparent"
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
                          hasCustomPermissions={hasCustomPermissions}
                          mode={(status?.mode ?? "ask") as "ask" | "auto" | "custom"}
                          onSetMode={connected ? handleSetMode : undefined}
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
