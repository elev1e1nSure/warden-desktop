import { motion } from "framer-motion";

interface AnimatedInfoProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedInfo({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedInfoProps) {
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
      <title>About</title>
      <motion.g
        style={{ transformOrigin: "12px 12px" }}
        animate={
          isHovered
            ? {
                rotate: 360,
                scale: 1.15,
              }
            : {
                rotate: 0,
                scale: 1,
              }
        }
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 14,
          mass: 0.8,
        }}
      >
        {/* Outer circle */}
        <circle cx="12" cy="12" r="10" />
        {/* Line */}
        <path d="M12 16v-4" />
        {/* Dot of "i" */}
        <path d="M12 8h.01" />
      </motion.g>
    </svg>
  );
}
