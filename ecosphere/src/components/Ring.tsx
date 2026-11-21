"use client";

import { useRef } from "react";
import { useTween } from "./Motion";

const TICKS = 72; // one every 5°
const R_OUT = 47, R_IN = 38, R_IN_MAJOR = 35; // quarter notches reach further in
const LEAF = "M0-7C4-5 5 0 0 7-5 0-4-5 0-7z"; // tiny leaf, tip pointing along the arc

// Bezel of ticks that light up in sequence; a leaf rides the leading tip. The ticks, the leaf
// and the printed percent all read the same tween frame, so they can never disagree.
export function Ring({ percent, label, size = 160 }: { percent: number; label: string; size?: number }) {
  const ticks = useRef<(SVGLineElement | null)[]>([]);
  const leaf = useRef<SVGGElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useTween(percent, (v) => {
    const lit = (v / 100) * TICKS;
    ticks.current.forEach((t, i) => {
      if (!t) return;
      const on = i < lit;
      t.setAttribute("stroke", on ? "#a2d47e" : "#2a332d");
      // The few ticks just behind the tip glow brighter, like a fresh growth edge.
      t.setAttribute("stroke-opacity", on ? String(Math.max(0.55, 1 - (lit - i) / 14)) : "1");
    });
    leaf.current?.setAttribute("transform", `rotate(${(v / 100) * 360}) translate(0 -${R_OUT + 1}) rotate(90)`);
    leaf.current?.setAttribute("opacity", v > 0.5 ? "1" : "0");
    if (num.current) num.current.textContent = String(Math.round(v));
  });
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${percent}% ${label}`}>
      <svg viewBox="-52 -52 104 104" className="overflow-visible" aria-hidden>
        <circle r="31" fill="none" stroke="#1b221d" strokeWidth="0.6" strokeDasharray="0.6 2.4" />
        {Array.from({ length: TICKS }, (_, i) => {
          const a = (i / TICKS) * 2 * Math.PI, major = i % (TICKS / 4) === 0;
          const r1 = major ? R_IN_MAJOR : R_IN;
          return (
            <line key={i} ref={(el) => { ticks.current[i] = el; }} stroke="#2a332d" strokeWidth={major ? 2.2 : 1.6} strokeLinecap="round"
              x1={Math.sin(a) * r1} y1={-Math.cos(a) * r1} x2={Math.sin(a) * R_OUT} y2={-Math.cos(a) * R_OUT} />
          );
        })}
        <g ref={leaf} opacity="0">
          <path d={LEAF} fill="#e4efe2" />
          <path d="M0-5.5V5.5" stroke="#1e3a28" strokeWidth="0.7" strokeLinecap="round" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="flex items-start font-semibold leading-none tracking-tight tabular-nums" style={{ fontSize: size * 0.24 }}>
          <span ref={num}>0</span><span className="mt-[0.18em] text-[0.42em] font-medium text-leaf">%</span>
        </span>
        <span className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-mute">{label}</span>
      </div>
    </div>
  );
}
