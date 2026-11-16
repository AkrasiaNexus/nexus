"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const TAB_ROOTS = ["/home", "/stats", "/marketplace", "/profile"];
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Re-keys on route change so each screen plays its entrance: tabs crossfade, sub-screens push.
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div key={path} className={TAB_ROOTS.includes(path) ? "view-fade" : "view-push"}>{children}</div>;
}

// Counts from the previously shown value to `value`; jumps straight there under reduced motion.
// First data draws in; later data changes (e.g. a new period) crossfade instead of replaying the entrance.
export function DataSwap({ id, children }: { id: string; children: React.ReactNode }) {
  const firstId = useRef(id);
  return <div key={id} className={id === firstId.current ? undefined : "data-swap"}>{children}</div>;
}

export function CountUp({ value, duration = 900, decimals = 0, suffix = "" }: { value: number; duration?: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = from.current;
    const format = (n: number) => `${n.toFixed(decimals)}${suffix}`;
    if (reducedMotion()) { el.textContent = format(value); from.current = value; return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = easeOutExpo((now - t0) / duration);
      el.textContent = format(start + (value - start) * k);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration, decimals, suffix]);
  return <span ref={ref} className="tabular-nums">{`${value.toFixed(decimals)}${suffix}`}</span>;
}
