interface ResizeHandleProps {
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}

export default function ResizeHandle({ sidebarWidth, setSidebarWidth }: ResizeHandleProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only drag handle
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = sidebarWidth;
        const onMove = (ev: MouseEvent) =>
          setSidebarWidth(Math.min(400, Math.max(180, startW + ev.clientX - startX)));
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      }}
      className="relative z-10 w-0 shrink-0 cursor-col-resize"
    >
      <div className="absolute inset-y-0 -left-2 -right-2" />
    </div>
  );
}
