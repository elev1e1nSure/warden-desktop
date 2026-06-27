import { useEffect, useRef } from "react";

export function useEscape(onEscape: () => void) {
  const cbRef = useRef(onEscape);
  cbRef.current = onEscape;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cbRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
