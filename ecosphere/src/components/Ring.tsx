"use client";

import { useRef } from "react";
import { useTween } from "./Motion";

const R = 42;
const C = 2 * Math.PI * R;

// The stroke and the printed percent are driven by the same tween frame, so the line's tip
// always sits exactly at the number shown.
export function Ring({ percent, label, size = 160 }: { percent: number; label: string; size?: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useTween(percent, (v) => {
    arc.current?.setAttribute("stroke-dashoffset", String(C * (1 - v / 100)));
    if (num.current) num.current.textContent = `${Math.round(v)}%`;
  });
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${percent}% ${label}`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#1d3523" strokeWidth="8" />
        <circle ref={arc} cx="50" cy="50" r={R} fill="none" stroke="#8fdc7f" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 64 64"><path d="M56 6C30 6 10 20 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 41-18 37-50z" fill="#86d67e" /></svg>
        <span ref={num} className="text-3xl font-bold tabular-nums">0%</span>
        <span className="text-xs text-mute">{label}</span>
      </div>
    </div>
  );
}
