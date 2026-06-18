import { motion } from "framer-motion";

interface AnimatedTrashProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedTrash({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedTrashProps) {
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
      <title>Delete</title>
      {/* Lid (bar + handle) grouped to animate together */}
      <motion.g
        style={{ transformOrigin: "12px 6px" }}
        animate={
          isHovered
            ? {
                y: -3,
                rotate: -12,
                x: -0.5,
              }
            : {
                y: 0,
                rotate: 0,
                x: 0,
              }
        }
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 15,
        }}
      >
        {/* Lid bar */}
        <path d="M3 6h18" />
        {/* Lid handle */}
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </motion.g>
      {/* Trash bin body */}
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    </svg>
  );
}
