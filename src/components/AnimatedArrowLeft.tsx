import { motion } from "framer-motion";

interface AnimatedArrowLeftProps {
  className?: string;
  strokeWidth?: number;
  isHovered?: boolean;
}

export default function AnimatedArrowLeft({
  className,
  strokeWidth = 1.75,
  isHovered = false,
}: AnimatedArrowLeftProps) {
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
      <title>Back</title>
      <motion.g
        animate={isHovered ? { x: -3.5 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </motion.g>
    </svg>
  );
}
