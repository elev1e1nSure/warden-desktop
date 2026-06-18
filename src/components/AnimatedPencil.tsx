import { motion } from "framer-motion";

interface AnimatedPencilProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedPencil({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedPencilProps) {
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
      <title>Rename</title>
      <motion.g
        style={{ transformOrigin: "2px 22px" }}
        animate={
          isHovered
            ? {
                rotate: [0, -8, 6, -8, 0],
                x: [0, 0.5, -0.5, 0.5, 0],
                y: [0, -0.5, 0.5, -0.5, 0],
              }
            : {
                rotate: 0,
                x: 0,
                y: 0,
              }
        }
        transition={
          isHovered
            ? {
                duration: 0.55,
                ease: "easeInOut",
              }
            : {
                type: "spring",
                stiffness: 300,
                damping: 15,
              }
        }
      >
        {/* Pencil body */}
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        {/* Eraser band separator */}
        <path d="m15 5 4 4" />
      </motion.g>
    </svg>
  );
}
