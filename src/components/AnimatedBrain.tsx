import { motion } from "framer-motion";

interface AnimatedBrainProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedBrain({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedBrainProps) {
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
      <title>Memory Settings</title>
      <motion.g
        style={{ transformOrigin: "12px 12px" }}
        animate={
          isHovered
            ? {
                scale: [1, 1.15, 0.95, 1.05, 1],
              }
            : {
                scale: 1,
              }
        }
        transition={
          isHovered
            ? {
                duration: 0.65,
                ease: "easeInOut",
              }
            : {
                type: "spring",
                stiffness: 300,
                damping: 15,
              }
        }
      >
        {/* Left hemisphere */}
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        {/* Right hemisphere */}
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        {/* Divider */}
        <path d="M12 5V18" />
        {/* Internal folds */}
        <path d="M12 15h2a3 3 0 0 0 3-3v0" />
        <path d="M12 9h2a3 3 0 0 0 3-3v0" />
        <path d="M12 12h-2a3 3 0 0 0-3 3v0" />
        <path d="M12 9h-2a3 3 0 0 0-3-3v0" />
      </motion.g>
    </svg>
  );
}
