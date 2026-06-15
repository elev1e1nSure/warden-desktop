import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface AnimatedIconProps {
  children: ReactNode;
  className?: string;
  size?: number;
}

const spring = { type: "spring", stiffness: 300, damping: 22, mass: 0.6 } as const;

const variants = {
  normal: { scale: 1, rotate: 0 },
  hover: { scale: 1.12, rotate: 0 },
};

export default function AnimatedIcon({ children, className, size = 20 }: AnimatedIconProps) {
  return (
    <motion.div
      whileHover="hover"
      initial="normal"
      animate="normal"
      variants={variants}
      transition={spring}
      style={{ width: size, height: size }}
      className={cn("flex shrink-0 items-center justify-center", className)}
    >
      {children}
    </motion.div>
  );
}
