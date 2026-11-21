import { LayoutDashboard, CalendarDays, CheckCircle2, SkipForward, Settings } from "lucide-react";

const NAV = [
  { id: "week", label: "This Week", icon: CalendarDays },
  { id: "all", label: "Everything", icon: LayoutDashboard },
  { id: "done", label: "Completed", icon: CheckCircle2 },
  { id: "skipped", label: "Skipped", icon: SkipForward },
];

export default function Sidebar({ active, onNavigate, stats }) {
  return (
    <aside className="w-56 shrink-0 border-r border-donna-border bg-donna-bg p-4 flex flex-col gap-1">
      <h1 className="text-lg font-bold text-donna-accent mb-6 px-3">⚡ Donna</h1>
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left ${
            active === id
              ? "bg-donna-accent/10 text-donna-accent"
              : "text-donna-muted hover:text-donna-text hover:bg-donna-surface"
          }`}
        >
          <Icon size={16} />
          <span className="flex-1">{label}</span>
          {stats[id] > 0 && (
            <span className="text-xs bg-donna-border px-1.5 py-0.5 rounded-full">
              {stats[id]}
            </span>
          )}
        </button>
      ))}
      <div className="mt-auto">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-donna-muted hover:text-donna-text hover:bg-donna-surface transition-colors w-full text-left">
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}
