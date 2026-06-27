import { useState } from "react";
import AnimatedArrowLeft from "./AnimatedArrowLeft";

interface BackButtonProps {
  onClick: () => void;
}

export default function BackButton({ onClick }: BackButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-text-secondary transition-none hover:bg-fill-hover hover:text-text-primary"
    >
      <AnimatedArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} isHovered={hovered} />
      <span className="text-ui-lg font-medium tracking-[-0.01em]">Back</span>
    </button>
  );
}
