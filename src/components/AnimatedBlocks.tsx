import { motion } from "framer-motion";

interface AnimatedBlocksProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedBlocks({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedBlocksProps) {
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
      <title>Blocks</title>
      <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />
      {/* Detached/4th top right block - animated! */}
      <motion.rect
        width="7"
        height="7"
        x="14"
        y="3"
        rx="1"
        style={{ transformOrigin: "17.5px 6.5px" }}
        animate={
          isHovered
            ? {
                x: 1.5,
                y: -1.5,
                rotate: 12,
              }
            : {
                x: 0,
                y: 0,
                rotate: 0,
              }
        }
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 15,
        }}
      />
    </svg>
  );
}
