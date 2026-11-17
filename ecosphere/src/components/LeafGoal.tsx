"use client";

import { useId, useMemo, useRef } from "react";
import { buildLeaf, veinFill } from "@/lib/leaf";
import { useTween } from "./Motion";

// Focal moment: sap climbs the petiole, up the midrib and out along each vein, lighting the
// network only as far as the goal percent. At 100% the margin lights too: the whole leaf is alive.
export function LeafGoal({ percent, label, size = 212 }: { percent: number; label: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  const { blade, veins } = useMemo(buildLeaf, []);
  const lit = useRef<(SVGPathElement | null)[]>([]);
  const front = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const midrib = veins.findIndex((v) => v.kind === "midrib");

  // Veins, sap front and printed percent all read the same tween frame.
  useTween(percent, (p) => {
    const g = p / 100;
    veins.forEach((v, i) => {
      const el = lit.current[i];
      if (!el) return;
      const f = veinFill(g, v);
      el.style.strokeDashoffset = String(1 - f);
      el.style.opacity = f > 0 ? "1" : "0"; // no stray round-cap dot on unlit veins
    });
    const rib = lit.current[midrib];
    const f = veinFill(g, veins[midrib]);
    if (rib && front.current) {
      const pt = rib.getPointAtLength(f * rib.getTotalLength());
      front.current.setAttribute("cx", String(pt.x));
      front.current.setAttribute("cy", String(pt.y));
      front.current.style.opacity = f > 0 && f < 1 ? "1" : "0";
    }
    if (num.current) num.current.textContent = `${Math.round(p)}%`;
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 1.35 }} role="img" aria-label={`${percent}% ${label}`}>
      <svg viewBox="0 0 200 270" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`${id}b`} x1="0" y1="1" x2="0.4" y2="0">
            <stop offset="0" stopColor="#0f2615" />
            <stop offset="1" stopColor="#1b3d22" />
          </linearGradient>
          <clipPath id={`${id}k`}><path d={blade} /></clipPath>
          <filter id={`${id}g`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Lamina and the dormant vein network: what's still to grow. */}
        <path d={blade} fill={`url(#${id}b)`} />
        <g fill="none" stroke="#2c5233" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${id}k)`}>
          {veins.filter((v) => v.kind !== "margin" && v.kind !== "petiole").map((v, i) => <path key={i} d={v.d} strokeWidth={v.width} />)}
        </g>
        <path d={veins[0].d} fill="none" stroke="#2c5233" strokeWidth={veins[0].width} strokeLinecap="round" />
        <path d={blade} fill="none" stroke="#86d67e" strokeOpacity=".22" strokeWidth="1" />

        {/* Sap layer: each path is drawn up to its share of the goal. */}
        <g fill="none" stroke="#b6f2a8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}g)`}>
          {veins.map((v, i) => (
            <path key={i} ref={(el) => { lit.current[i] = el; }} d={v.d} strokeWidth={v.width} pathLength={1}
              strokeDasharray="1 1" strokeDashoffset={1} style={{ opacity: 0 }} />
          ))}
          <circle ref={front} r="3.6" fill="#e6ffdf" stroke="none" style={{ opacity: 0 }} />
        </g>

        {/* Soft plate so the number stays legible over lit veins. */}
        <ellipse cx="100" cy="128" rx="50" ry="30" fill="#07120a" opacity=".72" style={{ filter: "blur(8px)" }} />
      </svg>
      <div className="absolute inset-x-0 flex flex-col items-center text-center" style={{ top: `${(128 / 270) * 100}%`, transform: "translateY(-50%)" }}>
        <span ref={num} className="text-4xl font-bold tabular-nums" aria-hidden>0%</span>
        <span className="text-sm text-white/85" aria-hidden>{label}</span>
      </div>
    </div>
  );
}
