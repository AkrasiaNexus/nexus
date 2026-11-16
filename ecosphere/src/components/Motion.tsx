"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const TAB_ROOTS = ["/home", "/stats", "/marketplace", "/profile"];
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
// Shared duration for value-driven motion (leaf fill, ring sweep, count-ups).
export const VALUE_MS = 1300;

// Re-keys on route change so each screen plays its entrance: tabs crossfade, sub-screens push.
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div key={path} className={TAB_ROOTS.includes(path) ? "view-fade" : "view-push"}>{children}</div>;
}

// One clock per value: everything that depicts the same number reads from the same frame,
// so a ring's stroke, a leaf's fill and the printed percent can never drift apart.
export function useTween(value: number, apply: (v: number) => void, duration = VALUE_MS) {
  const current = useRef(0);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    const from = current.current;
    const set = (v: number) => { current.current = v; applyRef.current(v); };
    if (reducedMotion()) { set(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = easeOutExpo((now - t0) / duration);
      set(from + (value - from) * k);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
}

// Counts from the previously shown value to `value`; jumps straight there under reduced motion.
export function CountUp({ value, duration = VALUE_MS, decimals = 0, suffix = "" }: { value: number; duration?: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useTween(value, (v) => { if (ref.current) ref.current.textContent = `${v.toFixed(decimals)}${suffix}`; }, duration);
  return <span ref={ref} className="tabular-nums" aria-label={`${value.toFixed(decimals)}${suffix}`}>{`${(0).toFixed(decimals)}${suffix}`}</span>;
}
