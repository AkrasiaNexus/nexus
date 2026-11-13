import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { createEvent, toggleRsvp } from "../../feature-actions";

const KINDS = { ALL: "All", EVENT: "Events", WORKSHOP: "Workshops", CAMPAIGN: "Campaigns", PROGRAM: "Recycling programs" } as const;
const ICON: Record<string, string> = { EVENT: "📅", WORKSHOP: "🛠️", CAMPAIGN: "📣", PROGRAM: "♻️" };

export default async function Events({ searchParams }: { searchParams: { k?: string } }) {
  const user = await requireUser();
  const k = searchParams.k && searchParams.k in KINDS ? searchParams.k : "ALL";
  // Parents see events at their children's schools.
  const schoolIds = user.role === "PARENT"
    ? (await db.user.findMany({ where: { parentId: user.id }, select: { schoolId: true } })).flatMap((c) => (c.schoolId ? [c.schoolId] : []))
    : user.schoolId ? [user.schoolId] : [];
  const events = await db.event.findMany({
    where: { startsAt: { gte: new Date() }, OR: [{ schoolId: null }, { schoolId: { in: schoolIds } }], ...(k !== "ALL" && { kind: k }) },
    include: { rsvps: true, organizer: { select: { name: true } } }, orderBy: { startsAt: "asc" },
  });
  const canCreate = ["TEACHER", "SCHOOL_ADMIN", "COMMUNITY", "SUPER_ADMIN"].includes(user.role);
  return (
    <>
      <Header title="Events & Campaigns" />
      <div className="flex flex-col gap-3 px-5">
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(KINDS).map(([key, v]) => <Link key={key} href={`/events?k=${key}`} className={`chip shrink-0 ${key === k ? "chip-on" : ""}`}>{v}</Link>)}
        </nav>
        {events.map((e) => {
          const going = e.rsvps.some((r) => r.userId === user.id);
          return (
            <article key={e.id} className="card space-y-2 p-4">
              <div className="flex gap-3"><span className="text-2xl">{ICON[e.kind]}</span>
                <div className="flex-1"><p className="font-medium">{e.title}</p><p className="text-sm text-mute">{e.description}</p></div></div>
              <p className="flex items-center gap-1 text-xs text-mute"><CalendarDays size={14} />{e.startsAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="flex items-center gap-1 text-xs text-mute"><MapPin size={14} />{e.location}{e.organizer && ` · by ${e.organizer.name}`}</p>
              <form action={toggleRsvp.bind(null, e.id)} className="flex items-center justify-between">
                <span className="text-xs text-mute">{e.rsvps.length} going</span>
                <button className={going ? "btn-ghost px-4 py-1.5 text-xs" : "btn px-4 py-1.5 text-xs"}>{going ? "✓ Going · cancel" : "Join"}</button>
              </form>
            </article>
          );
        })}
        {events.length === 0 && <p className="card p-6 text-center text-sm text-mute">No upcoming events.</p>}
        {canCreate && (
          <ActionForm action={createEvent} submit="Publish">
            <h2 className="text-sm font-medium">Create an event</h2>
            <select name="kind" aria-label="Type" className="input"><option value="EVENT">Event</option><option value="WORKSHOP">DIY / repurpose workshop</option><option value="CAMPAIGN">Campaign</option><option value="PROGRAM">Local recycling program</option></select>
            <input name="title" required maxLength={80} placeholder="Title" aria-label="Title" className="input" />
            <textarea name="description" required maxLength={280} rows={2} placeholder="Description" aria-label="Description" className="input" />
            <input name="location" required maxLength={80} placeholder="Location" aria-label="Location" className="input" />
            <input name="startsAt" type="datetime-local" required aria-label="Start time" className="input" />
          </ActionForm>
        )}
      </div>
    </>
  );
}
