import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Header({ title, back = "/home", right }: { title: string; back?: string | null; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-5 pb-3 pt-6">
      {back && (
        <Link href={back} aria-label="Back" className="-ml-2 rounded-full p-2 hover:bg-card">
          <ChevronLeft size={20} />
        </Link>
      )}
      <h1 className="flex-1 text-xl font-semibold">{title}</h1>
      {right}
    </header>
  );
}

export function Stat({ icon, value, label }: { icon?: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3 text-center">
      {icon && <span className="text-leaf">{icon}</span>}
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-[11px] leading-tight text-mute">{label}</span>
    </div>
  );
}

export function MenuRow({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-panel">
      <span className="text-leaf">{icon}</span>
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
        <span className="text-3xl font-bold">{percent}%</span>
        <span className="text-xs text-mute">{label}</span>
      </div>
    </div>
  );
}

export function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.value} kg`}>
          <div className="w-full rounded-t-md bg-gradient-to-t from-leafDark to-leaf" style={{ height: `${(d.value / max) * 100}%`, minHeight: 2 }} />
          <span className="text-[10px] text-mute">{d.label}</span>
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
