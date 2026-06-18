import { motion } from "framer-motion";

interface AnimatedSlidersProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedSliders({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedSlidersProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: "visible" }}
    >
      <title>General Settings</title>
      {/* Continuous tracks */}
      <path d="M3 5h18" />
      <path d="M3 12h18" />
      <path d="M3 19h18" />

      {/* Top knob (default x=14) - slides left */}
      <motion.path
        d="M14 3v4"
        animate={isHovered ? { x: -4 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 12 }}
      />

      {/* Middle knob (default x=8) - slides right */}
      <motion.path
        d="M8 10v4"
        animate={isHovered ? { x: 5 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 12 }}
      />

      {/* Bottom knob (default x=16) - slides left */}
      <motion.path
        d="M16 17v4"
        animate={isHovered ? { x: -5 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 12 }}
      />
    </svg>
  );
}
