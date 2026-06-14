// Single source of truth for animation timing.
// Phase 6 wires every framer-motion call in the app to these tokens so the
// whole UI shares one easing curve and three durations. Keep CSS timings
// (index.css: --ease-standard / --dur-*) in sync with this file.

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.12,
  base: 0.18,
  slow: 0.22,
} as const;

/** Plain opacity fade — view swaps, overlays. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DUR.base, ease: EASE },
};

/** Subtle rise-in — list items, message blocks. */
export const riseIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.slow, ease: EASE },
};

/** Height collapse — expandable sections (think / tools / chats). */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: DUR.base, ease: EASE },
};

/** Dropdown / menu pop — origin set by caller via transformOrigin. */
export const pop = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: DUR.fast, ease: EASE },
};
