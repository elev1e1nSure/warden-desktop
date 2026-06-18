import { motion } from "framer-motion";

interface AnimatedSquarePenProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedSquarePen({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedSquarePenProps) {
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
      <title>New Chat</title>
      {/* The square boundary */}
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      {/* The pen - animated! */}
      <motion.path
        d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
        style={{ transformOrigin: "12px 12px" }}
        animate={
          isHovered
            ? {
                x: [0, 0.5, -0.5, 0.5, 0],
                y: [0, -0.5, 0.5, -0.5, 0],
                rotate: [0, 8, -4, 8, 0],
              }
            : {
                x: 0,
                y: 0,
                rotate: 0,
              }
        }
        transition={
          isHovered
            ? {
                duration: 0.5,
                ease: "easeInOut",
              }
            : {
                type: "spring",
                stiffness: 300,
                damping: 15,
              }
        }
      />
    </svg>
  );
}
