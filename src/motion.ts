// Single source of truth for animation timing & variants.
// Every framer-motion call in the app pulls from here so the whole UI shares
// one easing curve, a small set of durations, and a coherent motion language.
// Reduced-motion is handled globally via <MotionConfig reducedMotion="user">.

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.12,
  base: 0.18,
  slow: 0.22,
} as const;

/** Snappy spring for sliding selection highlights (magic-move). */
export const HIGHLIGHT_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.7,
} as const;

/** Soft spring with a hint of overshoot — focal one-shot entrances. */
export const SOFT_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 26,
  mass: 0.9,
} as const;

/** Plain opacity fade — overlays. */
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

// ─── View-level transitions ──────────────────────────────────────────────────

/** Skills panel pushing in from the right (depth + blur). */
export const panelFromRight = {
  initial: { opacity: 0, x: 26, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: 26, filter: "blur(6px)" },
  transition: { duration: 0.24, ease: EASE },
};

/** Chat layout sliding back in from the left (mirror of panelFromRight). */
export const panelFromLeft = {
  initial: { opacity: 0, x: -26, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -26, filter: "blur(6px)" },
  transition: { duration: 0.24, ease: EASE },
};

/** Timeline content reveal on chat switch / new chat — rises through blur. */
export const timelineReveal = {
  initial: { opacity: 0, y: 14, filter: "blur(7px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.32, ease: EASE },
};

/** Skill detail panel swap — horizontal glide. */
export const skillDetail = {
  initial: { opacity: 0, x: 16, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -12, filter: "blur(4px)" },
  transition: { duration: 0.22, ease: EASE },
};

/** Empty-state heading — focal pop with blur clearing, soft overshoot. */
export const headingPop = {
  initial: { opacity: 0, y: 14, scale: 0.95, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, scale: 0.98, filter: "blur(6px)" },
  transition: SOFT_SPRING,
};
