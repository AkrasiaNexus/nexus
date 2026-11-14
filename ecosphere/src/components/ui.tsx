import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

export function LineChart({ data, height = 150 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(0.1, ...data.map((d) => d.value));
  const w = 300, h = 100, step = w / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => [i * step, h - 8 - (d.value / max) * (h - 16)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`-6 0 ${w + 12} ${h}`} style={{ height }} className="w-full" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#86d67e" stopOpacity=".45" /><stop offset="1" stopColor="#86d67e" stopOpacity="0" /></linearGradient>
        </defs>
        {pts.map(([x], i) => <line key={i} x1={x} x2={x} y1="0" y2={h} stroke="#86d67e" strokeOpacity=".12" />)}
        <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#area)" />
        <path d={line} fill="none" stroke="#9be292" strokeWidth="2" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#0b120d" stroke="#9be292" strokeWidth="2"><title>{`${data[i].label}: ${data[i].value} kg`}</title></circle>)}
      </svg>
      <figcaption className="flex justify-between px-0.5 text-[11px] text-white/50">{data.map((d) => <span key={d.label}>{d.label}</span>)}</figcaption>
    </figure>
  );
}

export function Stat({ icon, value, label }: { icon?: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3 text-center">
      {icon && <span className="text-gold">{icon}</span>}
      <span className="text-lg font-semibold">{value}</span>
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

export function Ring({ percent, label, size = 160 }: { percent: number; label: string; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${percent}% ${label}`}>
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1d3523" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#8fdc7f" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden><path d="M56 6C30 6 10 20 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 41-18 37-50z" fill="#86d67e" /></svg>
        <span className="text-3xl font-bold">{percent}%</span>
        <span className="text-xs text-mute">{label}</span>
      </div>
    </div>
  );
}

export function Bars({ data, height = "h-32" }: { data: { label: string; value: number }[]; height?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`flex ${height} items-end gap-2`}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label ? `${d.label}: ` : ""}${d.value} kg`}>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-md bg-gradient-to-t from-leafDark to-leaf" style={{ height: `${(d.value / max) * 100}%`, minHeight: 2 }} />
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

// Pill dropdown (mockup "School ⌄", "This Month ⌄") built on <details>, no JS needed.
export function PillMenu({ label, items, className = "" }: { label: string; items: { href: string; label: string; on?: boolean }[]; className?: string }) {
  return (
    <details className={`group relative ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/[.06] bg-card px-4 py-2 text-sm [&::-webkit-details-marker]:hidden">
        {label}<ChevronRight size={14} className="rotate-90 transition group-open:-rotate-90" />
      </summary>
      <ul className="absolute left-1/2 z-30 mt-1 min-w-full -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#121b15] shadow-xl">
        {items.map((i) => <li key={i.href}><Link href={i.href} className={`block whitespace-nowrap px-4 py-2 text-sm hover:bg-white/5 ${i.on ? "text-leaf" : ""}`}>{i.label}</Link></li>)}
      </ul>
    </details>
  );
}
