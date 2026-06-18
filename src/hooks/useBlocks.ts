import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Block } from "../types";

export type { Block };

const stripEmptyThink = (blocks: Block[]): Block[] =>
  blocks.filter((b) => b.kind !== "think" || b.text.trim().length > 0);

export interface UseBlocksResult {
  blocks: Block[];
  blocksRef: React.MutableRefObject<Block[]>;
  commit: (next: Block[]) => void;
  loadBlocks: (next: Block[]) => void;
  genId: () => string;
  flushActiveChatBlocks: () => Promise<void>;
  stripEmptyThink: (blocks: Block[]) => Block[];
}

export function useBlocks(activeChatId: string | null): UseBlocksResult {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blocksRef = useRef<Block[]>([]);
  const idRef = useRef(0);
  const persistTimerRef = useRef<number | null>(null);
  // True when blocks have been modified by user actions and need to be saved.
  // False after loading blocks from DB or resetting — prevents startup from
  // wiping saved blocks by writing an empty array before content is loaded.
  const blocksDirtyRef = useRef(false);

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

  return { blocks, blocksRef, commit, loadBlocks, genId, flushActiveChatBlocks, stripEmptyThink };
}
