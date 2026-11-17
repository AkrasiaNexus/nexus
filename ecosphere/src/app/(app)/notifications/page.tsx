import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { notificationFeed } from "@/lib/queries";
import { Bell, CalendarDays, Check, ClipboardCheck, Gift, HeartPulse, Lightbulb, Store, Target, Truck } from "lucide-react";
import { Header, IconCircle, timeAgo, type Tone } from "@/components/ui";
import { markAllRead, markOneRead } from "../../notification-actions";

const TABS = { ALL: "All", UNREAD: "Unread", ANNOUNCEMENT: "Announcements", CHALLENGE: "Challenges", TASK: "Tasks", HEALTH: "Health & safety", EVENT: "Events", MARKETPLACE: "Marketplace", REWARD: "Rewards", PICKUP: "Pickups" } as const;
const ICON: Record<string, [React.ReactNode, Tone]> = {
  PICKUP: [<Truck key="i" size={22} />, "green"], CHALLENGE: [<Target key="i" size={22} />, "orange"], ANNOUNCEMENT: [<Lightbulb key="i" size={22} />, "green"],
  EVENT: [<CalendarDays key="i" size={22} />, "teal"], TASK: [<ClipboardCheck key="i" size={22} />, "gold"], HEALTH: [<HeartPulse key="i" size={22} />, "orange"],
  MARKETPLACE: [<Store key="i" size={22} />, "teal"], REWARD: [<Gift key="i" size={22} />, "gold"],
};
const FALLBACK: [React.ReactNode, Tone] = [<Bell key="i" size={22} />, "green"];

export default async function Notifications({ searchParams }: { searchParams: { t?: string } }) {
  const user = await requireUser();
  const tab = searchParams.t && searchParams.t in TABS ? searchParams.t : "ALL";
  const feed = await notificationFeed(user);
  const items = feed.filter((n) => tab === "ALL" || (tab === "UNREAD" ? !n.read : n.kind === tab));
  const unread = items.filter((n) => !n.read);
  return (
    <>
      <Header title="Notifications" right={
        <Link href="/settings#notifications" className="rounded-full px-3 py-2 text-xs text-mute hover:bg-card hover:text-white">Preferences</Link>
      } />
      <div className="stagger flex flex-col gap-3 px-5">
        <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {Object.entries(TABS).map(([k, v]) => <Link key={k} href={`/notifications?t=${k}`} className={`chip shrink-0 px-4 ${k === tab ? "chip-on" : ""}`}>{v}</Link>)}
        </nav>
        {unread.length > 0 && (
          <form action={markAllRead} className="flex items-center justify-between text-xs text-mute">
            <span>{unread.length} unread</span>
            {unread.map((n) => <input key={n.id} type="hidden" name="id" value={n.id} />)}
            <button className="rounded-full px-3 py-1.5 text-leaf hover:bg-card">Mark all as read</button>
          </form>
        )}
        <ul className="stagger card overflow-hidden">
          {items.map((n) => {
            const [icon, tone] = ICON[n.kind] ?? FALLBACK;
            return (
              <li key={n.id} className={`flex items-center gap-4 border-b border-line p-4 last:border-0 ${n.read ? "opacity-60" : ""}`}>
                <IconCircle tone={tone} size={46}>{icon}</IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm">
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-leaf" aria-label="Unread" />}{n.title}
                  </p>
                  <p className="text-xs text-white/55">{n.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 self-start">
                  <span className="text-[11px] text-white/50">{timeAgo(n.createdAt)}</span>
                  {!n.read && (
                    <form action={markOneRead.bind(null, n.id)}>
                      <button aria-label={`Mark "${n.title}" as read`} className="rounded-full p-1.5 text-mute hover:bg-panel hover:text-leaf"><Check size={14} /></button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="p-6 text-center text-sm text-mute">{tab === "UNREAD" ? "You're all caught up." : "Nothing here yet."}</li>}
        </ul>
      </div>
    </>
  );
}
