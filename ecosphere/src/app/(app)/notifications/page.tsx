import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { visibleNotifications } from "@/lib/queries";
import { CalendarDays, ClipboardCheck, HeartPulse, Lightbulb, Target, Truck } from "lucide-react";
import { Header, IconCircle, timeAgo, type Tone } from "@/components/ui";

const TABS = { ALL: "All", ANNOUNCEMENT: "Announcements", CHALLENGE: "Challenges", TASK: "Tasks", HEALTH: "Health & safety", PICKUP: "Pickups", EVENT: "Events" } as const;
const ICON: Record<string, [React.ReactNode, Tone]> = {
  PICKUP: [<Truck key="i" size={22} />, "green"], CHALLENGE: [<Target key="i" size={22} />, "orange"], ANNOUNCEMENT: [<Lightbulb key="i" size={22} />, "green"],
  EVENT: [<CalendarDays key="i" size={22} />, "teal"], TASK: [<ClipboardCheck key="i" size={22} />, "gold"], HEALTH: [<HeartPulse key="i" size={22} />, "orange"],
};

export default async function Notifications({ searchParams }: { searchParams: { t?: string } }) {
  const user = await requireUser();
  const tab = searchParams.t && searchParams.t in TABS ? searchParams.t : "ALL";
  const items = (await visibleNotifications(user.id)).filter((n) => tab === "ALL" || n.kind === tab);
  return (
    <>
      <Header title="Notifications" />
      <div className="flex flex-col gap-3 px-5">
        <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {Object.entries(TABS).map(([k, v]) => <Link key={k} href={`/notifications?t=${k}`} className={`chip shrink-0 px-4 ${k === tab ? "chip-on" : ""}`}>{v}</Link>)}
        </nav>
        <ul className="card overflow-hidden">
          {items.map((n) => (
            <li key={n.id} className="flex items-center gap-4 border-b border-line p-4 last:border-0">
              <IconCircle tone={ICON[n.kind][1]} size={46}>{ICON[n.kind][0]}</IconCircle>
              <div className="min-w-0 flex-1"><p className="text-sm">{n.title}</p><p className="text-xs text-white/55">{n.body}</p></div>
              <span className="shrink-0 self-start text-[11px] text-white/50">{timeAgo(n.createdAt)}</span>
            </li>
          ))}
          {items.length === 0 && <li className="p-6 text-center text-sm text-mute">Nothing here yet.</li>}
        </ul>
      </div>
    </>
  );
}
