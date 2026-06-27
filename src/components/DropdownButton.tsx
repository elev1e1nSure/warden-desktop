import { useState } from "react";
import { renderAnimatedIcon } from "../lib/icon";

interface DropdownButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export default function DropdownButton({ icon, label, onClick, danger }: DropdownButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fill-hover ${
        danger
          ? "text-danger hover:text-danger-hover"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{renderAnimatedIcon(icon, hovered)}</span>
      <span className="flex-1 text-ui-lg font-medium tracking-[-0.01em] transition-colors">
        {label}
      </span>
    </button>
  );
}
