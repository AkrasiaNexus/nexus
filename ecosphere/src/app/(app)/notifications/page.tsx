import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { visibleNotifications } from "@/lib/queries";
import { Header, timeAgo } from "@/components/ui";

const TABS = { ALL: "All", ANNOUNCEMENT: "Announcements", CHALLENGE: "Challenges", TASK: "Tasks", HEALTH: "Health & safety", PICKUP: "Pickups", EVENT: "Events" } as const;
const ICON = { ANNOUNCEMENT: "📣", CHALLENGE: "🎯", PICKUP: "🚛", EVENT: "📅", TASK: "📝", HEALTH: "🩺" };

export default async function Notifications({ searchParams }: { searchParams: { t?: string } }) {
  const user = await requireUser();
  const tab = searchParams.t && searchParams.t in TABS ? searchParams.t : "ALL";
  const items = (await visibleNotifications(user.id)).filter((n) => tab === "ALL" || n.kind === tab);
  return (
    <>
      <Header title="Notifications" />
      <div className="flex flex-col gap-3 px-5">
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(TABS).map(([k, v]) => <Link key={k} href={`/notifications?t=${k}`} className={`chip shrink-0 ${k === tab ? "chip-on" : ""}`}>{v}</Link>)}
        </nav>
        <ul className="card overflow-hidden">
          {items.map((n) => (
            <li key={n.id} className="flex gap-3 border-b border-line p-4 last:border-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-panel text-xl">{ICON[n.kind]}</span>
              <div className="flex-1"><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-mute">{n.body}</p></div>
              <span className="shrink-0 text-[11px] text-mute">{timeAgo(n.createdAt)}</span>
            </li>
          ))}
          {items.length === 0 && <li className="p-6 text-center text-sm text-mute">Nothing here yet.</li>}
        </ul>
      </div>
    </>
  );
}
