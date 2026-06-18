import { useEffect, useRef, useState } from "react";

/* While a block is streaming we get a state update on every token. Re-parsing
   markdown (and syntax-highlighting) that often is the main source of timeline
   lag on long answers. This trailing throttle caps how often the rendered text
   actually changes; the final value always flushes once streaming stops. */
export function useThrottledValue(value: string, ms: number, enabled: boolean): string {
  const [out, setOut] = useState(value);
  const latest = useRef(value);
  const lastEmit = useRef(0);
  const timer = useRef<number | null>(null);
  latest.current = value;

  useEffect(() => {
    if (!enabled) {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setOut(value);
      return;
    }
    const elapsed = Date.now() - lastEmit.current;
    if (elapsed >= ms) {
      lastEmit.current = Date.now();
      setOut(value);
    } else if (timer.current === null) {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        lastEmit.current = Date.now();
        setOut(latest.current);
      }, ms - elapsed);
    }
  }, [value, ms, enabled]);

  return enabled ? out : value;
}
