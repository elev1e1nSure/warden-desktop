// Single source of truth for animation timing & variants.
// Low-power tuning — minimal work for framer-motion, no heavy springs or long
// sequences. Reduced-motion is handled globally via <MotionConfig reducedMotion="user">.
//
// WebView2 (Tauri on Windows) notes:
// - `filter: blur()` forces software rasterisation — avoid.

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.08,
  base: 0.12,
  slow: 0.15,
} as const;

/** Soft spring with a hint of overshoot — focal one-shot entrances. */
export const SOFT_SPRING = {
  type: "spring",
  stiffness: 450,
  damping: 38,
  mass: 0.5,
} as const;

/** Dropdown / menu pop — origin set by caller via transformOrigin. */
export const pop = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: DUR.fast, ease: EASE },
};

/** Skill detail panel — slide down. */
export const skillDetailDown = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DUR.fast, ease: EASE },
};

/** Empty-state heading — focal pop, soft overshoot. */
export const headingPop = {
  initial: { opacity: 0, y: 14, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
  transition: SOFT_SPRING,
};

// ─── Timeline (chat) ──────────────────────────────────────────────────────────

/** A new timeline block (user / assistant / think / tool group) settling in. */
export const blockEnter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: EASE },
};

/** Crossfade for a label swapping in place — e.g. "Thinking…" → "Thought".
   Both states are absolutely positioned so they overlap; the small opposing
   y-offsets make the old label lift away as the new one settles in. */
export const labelFade = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -5 },
  transition: { duration: 0.3, ease: EASE },
} as const;

/** Expand / collapse for a disclosure body (thought reasoning, tool list). */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.2, ease: EASE },
} as const;
