"use client";

import { useEffect, useId, useRef } from "react";
import { CountUp, easeOutExpo, reducedMotion } from "./Motion";

const LEAF = "M178 14C96 10 30 46 22 116c-4 34 10 60 26 72 4-40 30-84 78-118-40 36-62 76-66 120 78 4 128-60 118-176z";
// The clip frame is rotated 45° so "up" runs along the midrib: y=217 at the stem, y=-16 at the tip.
const STEM_Y = 217;
const SPAN = 233;
const DURATION = 900;

// Focal moment: the leaf fills with chlorophyll from stem to tip up to the goal, and refills on period change.
export function LeafGoal({ percent, label, size = 250 }: { percent: number; label: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  const rect = useRef<SVGRectElement>(null);
  const level = useRef(0);

  useEffect(() => {
    const el = rect.current;
    if (!el) return;
    const set = (p: number) => { const h = (p / 100) * SPAN; el.setAttribute("y", String(STEM_Y - h)); el.setAttribute("height", String(h + 40)); };
    const from = level.current;
    if (reducedMotion()) { set(percent); level.current = percent; return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = from + (percent - from) * easeOutExpo((now - t0) / DURATION);
      set(p);
      level.current = p;
      if (now - t0 < DURATION) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${percent}% ${label}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 drop-shadow-[0_10px_30px_rgba(60,150,70,.35)]" aria-hidden>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1f5a2a" />
            <stop offset=".55" stopColor="#3f9a48" />
            <stop offset="1" stopColor="#9be292" />
          </linearGradient>
          <radialGradient id={`${id}s`} cx=".7" cy=".25" r=".6">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}c`} transform="rotate(45 100 100)">
            <rect ref={rect} x="-80" y={STEM_Y} width="360" height="0" />
          </clipPath>
        </defs>
        {/* Unfilled leaf: the goal still to reach. */}
        <path d={LEAF} fill="#16301c" stroke="#86d67e" strokeOpacity=".25" strokeWidth="1" />
        <g clipPath={`url(#${id}c)`}>
          <path d={LEAF} fill={`url(#${id}f)`} />
          <path d={LEAF} fill={`url(#${id}s)`} />
        </g>
        <g stroke="#c8f5c0" strokeOpacity=".25" strokeWidth="1.2" fill="none">
          <path d="M60 190C80 120 120 70 170 22" />
          <path d="M95 120c-20-6-36-4-50 4M112 96c-16-10-34-12-50-8M130 74c-12-12-26-18-42-18M120 110c18 4 34 2 48-6M138 86c14 0 28-6 38-16" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pl-6 pt-4 text-center">
        <span className="text-4xl font-bold drop-shadow"><CountUp value={percent} duration={DURATION} suffix="%" /></span>
        <span className="text-sm text-white/90">{label}</span>
      </div>
    </div>
  );
}
