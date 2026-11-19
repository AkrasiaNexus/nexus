import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CountUp } from "./Motion";
export { Ring } from "./Ring";
export { PillMenu } from "./PillMenu";

// Mockup style: sub-screens get a back arrow + centred title; tab screens a large left title.
export function Header({ title, back = "/home", right }: { title: string; back?: string | null; right?: React.ReactNode }) {
  if (!back)
    return (
      <header className="flex items-center gap-3 px-5 pb-4 pt-8">
        <h1 className="flex-1 text-2xl font-semibold">{title}</h1>
        {right}
      </header>
    );
  return (
    <header className="relative flex items-center px-5 pb-4 pt-7">
      <Link href={back} aria-label="Back" className="-ml-2 rounded-full p-2 hover:bg-card"><ChevronLeft size={22} /></Link>
      <h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-lg font-semibold">{title}</h1>
      <span className="ml-auto">{right}</span>
    </header>
  );
}

const TONES = {
  green: "from-[#2f6b34] to-[#163a1b] text-[#9be292]",
  gold: "from-[#7a5a14] to-[#3d2c08] text-gold",
  orange: "from-[#8a4a12] to-[#45240a] text-[#ffa04d]",
  teal: "from-[#1d5a4c] to-[#0d2e27] text-[#7fe0c4]",
};
export type Tone = keyof typeof TONES;

export function IconCircle({ children, tone = "green", size = 44 }: { children: React.ReactNode; tone?: Tone; size?: number }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br shadow-inner shadow-black/40 ${TONES[tone]}`} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

type Point = { label: string; value: number; future?: boolean };
const W = 300, H = 120, TOP = 14, BOTTOM = 104, PAD = 10;

// Catmull-Rom through the points, as cubic Béziers; control points clamped to the plot so the curve never dips below zero.
function smooth(pts: (readonly [number, number])[]) {
  const clampY = (y: number) => Math.min(BOTTOM, Math.max(TOP, y));
  return pts.map(([x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [x0, y0] = pts[i - 2] ?? pts[i - 1], [x1, y1] = pts[i - 1], [x3, y3] = pts[i + 1] ?? [x, y];
    const c1 = [x1 + (x - x0) / 6, clampY(y1 + (y - y0) / 6)], c2 = [x - (x3 - x1) / 6, clampY(y - (y3 - y1) / 6)];
    return `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function LineChart({ data, height = 170 }: { data: Point[]; height?: number }) {
  const past = data.filter((d) => !d.future);
  const max = Math.max(0.1, ...past.map((d) => d.value));
  const xAt = (i: number) => PAD + (i / Math.max(1, data.length - 1)) * (W - PAD * 2);
  const yAt = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const pts = past.map((d, i) => [xAt(i), yAt(d.value)] as const);
  const line = smooth(pts);
  const last = pts[pts.length - 1];
  const nice = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  return (
    <figure className="select-none">
      {/* Re-keyed on new data so every period switch redraws the line left-to-right. */}
      <div key={`${data.length}:${data.map((d) => d.value).join()}`} className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img"
          aria-label={`Trend: ${past.map((d) => `${d.label} ${d.value} kg`).join(", ")}`}>
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a2d47e" stopOpacity=".28" /><stop offset="1" stopColor="#a2d47e" stopOpacity="0" /></linearGradient>
          </defs>
          {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#fff" strokeOpacity={y === BOTTOM ? 0.14 : 0.06} vectorEffect="non-scaling-stroke" />)}
          {last && last[0] < W - PAD && (
            <line x1={last[0]} x2={W - PAD} y1={BOTTOM} y2={BOTTOM} stroke="#a2d47e" strokeOpacity=".35" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          )}
          {pts.length > 1 && <>
            <path d={`${line} L${last[0]},${BOTTOM} L${pts[0][0]},${BOTTOM} Z`} fill="url(#area)" className="chart-anim" style={{ animation: "fade-in 750ms 320ms var(--ease-out) both" }} />
            {/* Revealed left-to-right with a clip: dash tricks break under non-scaling strokes. */}
            <path d={line} fill="none" stroke="#a2d47e" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              className="line-anim" style={{ animation: "reveal-x 1300ms var(--ease-out) both" }} />
          </>}
        </svg>
        {/* Dots and labels live in HTML so they stay round and crisp at any chart width. */}
        <span className="pointer-events-none absolute -left-1 text-[10px] tabular-nums text-white/35" style={{ top: `${(TOP / H) * 100}%`, transform: "translateY(-120%)" }}>{nice(max)} kg</span>
        {pts.map(([x, y], i) => {
          const isLast = i === pts.length - 1;
          return (
            <span key={i} className="chart-anim absolute" title={`${past[i].label}: ${past[i].value} kg`}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: "translate(-50%,-50%)", animation: `pop-in 450ms ${190 + (i / Math.max(1, data.length - 1)) * 1000}ms var(--ease-out) both` }}>
              {isLast ? (
                <span className="relative grid place-items-center">
                  <span className="pulse-soft absolute h-6 w-6 rounded-full bg-leaf/25" />
                  <span className="h-3 w-3 rounded-full border-2 border-ink bg-leaf shadow-[0_0_0_1px_#a2d47e]" />
                  <span className="absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-leaf px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink">{past[i].value} kg</span>
                </span>
              ) : <span className="block h-1.5 w-1.5 rounded-full bg-leaf/80" />}
            </span>
          );
        })}
      </div>
      <figcaption className="relative mt-2 h-4 text-[11px]">
        {data.map((d, i) => (
          <span key={d.label + i} className={`absolute -translate-x-1/2 ${d.future ? "text-white/25" : i === past.length - 1 ? "font-medium text-white" : "text-white/55"}`}
            style={{ left: `${(xAt(i) / W) * 100}%` }}>{d.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

// "12.6 kg", "239 EC", 42 → counts up to the number and keeps its unit; anything else renders as is.
function countable(value: React.ReactNode) {
  const m = typeof value === "number" ? [String(value), String(value), ""] : typeof value === "string" ? value.match(/^(\d+(?:\.\d+)?)(.*)$/) : null;
  if (!m) return value;
  const decimals = m[1].includes(".") ? m[1].split(".")[1].length : 0;
  return <CountUp value={Number(m[1])} decimals={decimals} suffix={m[2]} />;
}

export function Stat({ icon, value, label }: { icon?: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3 text-center">
      {icon && <span className="text-gold">{icon}</span>}
      <span className="text-lg font-semibold">{countable(value)}</span>
      <span className="text-[11px] leading-tight text-white/60">{label}</span>
    </div>
  );
}

export function MenuRow({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-panel">
      <span className="text-white/70">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {hint && <span className="text-xs text-mute">{hint}</span>}
      <ChevronRight size={16} className="text-mute" />
    </Link>
  );
}

export function Bars({ data, height = "h-32" }: { data: { label: string; value: number }[]; height?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`flex ${height} items-end gap-2`}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label ? `${d.label}: ` : ""}${d.value} kg`}>
          <div className="flex w-full flex-1 items-end">
            <div className="bar-anim w-full origin-bottom rounded-t-md bg-gradient-to-t from-leafDark to-leaf"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 2, animation: `bar-grow 650ms ${Math.min(i, 12) * 50}ms var(--ease-out) both` }} />
          </div>
          {d.label && <span className="text-[10px] text-mute">{d.label}</span>}
        </div>
      ))}
    </div>
  );
}

export const timeAgo = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function Heatmap({ grid, rowLabels, colLabels }: { grid: number[][]; rowLabels: string[]; colLabels: string[] }) {
  const max = Math.max(0.1, ...grid.flat());
  return (
    <table className="w-full border-separate border-spacing-1 text-[10px] text-mute">
      <thead><tr><th />{colLabels.map((c) => <th key={c} className="font-normal">{c}</th>)}</tr></thead>
      <tbody>
        {grid.map((row, i) => (
          <tr key={rowLabels[i]}>
            <th className="pr-1 text-left font-normal">{rowLabels[i]}</th>
            {row.map((v, j) => (
              <td key={j} title={`${v} kg`} className="h-7 rounded" style={{ background: v ? `rgba(143,220,127,${0.15 + 0.85 * (v / max)})` : "#0b1a0f" }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

