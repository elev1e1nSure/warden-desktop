import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

function WinBtn({
  onClick,
  close,
  children,
}: {
  onClick: () => void;
  close?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full w-[46px] items-center justify-center text-[15px] text-text-secondary/70 transition-colors ${
        close
          ? "hover:bg-[#c42b1c] hover:text-white"
          : "hover:bg-fill-active hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export default function TitleBar() {
  return (
    <div className="flex h-9 w-full shrink-0 select-none items-center bg-sidebar">
      <div className="flex-1 h-full" data-tauri-drag-region />

      <div className="flex h-full">
        <WinBtn onClick={() => win.minimize()}>
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" aria-label="Minimize">
            <rect width="10" height="1" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-label="Maximize"
          >
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.close()} close>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            stroke="currentColor"
            strokeWidth="1.1"
            aria-label="Close"
          >
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </WinBtn>
      </div>
    </div>
  );
}
