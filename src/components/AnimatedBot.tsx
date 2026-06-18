import { motion } from "framer-motion";

interface AnimatedBotProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedBot({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedBotProps) {
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
      <title>Agent Settings</title>
      <motion.g
        style={{ transformOrigin: "12px 20px" }}
        animate={
          isHovered
            ? {
                rotate: [0, -10, 8, -6, 4, 0],
              }
            : {
                rotate: 0,
              }
        }
        transition={
          isHovered
            ? {
                duration: 0.6,
                ease: "easeInOut",
              }
            : {
                type: "spring",
                stiffness: 300,
                damping: 15,
              }
        }
      >
        {/* Antenna */}
        <path d="M12 8V4H8" />
        {/* Head */}
        <rect width="16" height="12" x="4" y="8" rx="2" />
        {/* Ears */}
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        {/* Eyes */}
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </motion.g>
    </svg>
  );
}
