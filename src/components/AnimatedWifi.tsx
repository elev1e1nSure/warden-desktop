import { motion } from "framer-motion";

interface AnimatedWifiProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedWifi({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedWifiProps) {
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
      <title>Provider Settings</title>
      {/* Bottom dot */}
      <path d="M12 20h.01" />

      {/* Inner arc */}
      <motion.path
        d="M8.5 16.5a5 5 0 0 1 7 0"
        animate={isHovered ? { y: [0, -1.2, 0] } : { y: 0 }}
        transition={
          isHovered ? { duration: 0.3, ease: "easeInOut" } : { duration: 0.15, ease: "easeOut" }
        }
      />

      {/* Middle arc */}
      <motion.path
        d="M5 13a10 10 0 0 1 14 0"
        animate={isHovered ? { y: [0, -1.8, 0] } : { y: 0 }}
        transition={
          isHovered
            ? { duration: 0.3, ease: "easeInOut", delay: 0.08 }
            : { duration: 0.15, ease: "easeOut" }
        }
      />

      {/* Outer arc */}
      <motion.path
        d="M1.5 9.5a15 15 0 0 1 21 0"
        animate={isHovered ? { y: [0, -2.4, 0] } : { y: 0 }}
        transition={
          isHovered
            ? { duration: 0.3, ease: "easeInOut", delay: 0.16 }
            : { duration: 0.15, ease: "easeOut" }
        }
      />
    </svg>
  );
}
