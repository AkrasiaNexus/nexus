import Link from "next/link";
import { CalendarDays, MapPin, Recycle, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { impactFor, startOf, withDates } from "@/lib/queries";
import { ActionForm } from "@/components/ActionForm";
import { Header, Stat } from "@/components/ui";
import { addCollectionPoint, announceToCommunity, toggleCollectionPoint, toggleCommunityMember } from "../../community-actions";

const COMMUNITY_GOAL_KG = 100; // monthly collective target

// Members see their community's progress, campaigns and drop-off points; the community admin also manages it.
export default async function Community() {
  const me = await requireUser(["COMMUNITY", "COMMUNITY_ADMIN"]);
  const isAdmin = me.role === "COMMUNITY_ADMIN";
  const sb = createClient();
  if (!me.communityId) {
    return (<><Header title="My Community" /><p className="card mx-5 p-6 text-center text-sm text-white/60">Your account isn&apos;t linked to a community yet. Ask your community admin to add you.</p></>);
  }
  const [community, month, events, points, members] = await Promise.all([
    sb.from("communities").select("*").eq("id", me.communityId).single(),
    impactFor("community", startOf("month")),
    sb.from("events").select("*").eq("communityId", me.communityId).gte("startsAt", new Date().toISOString()).order("startsAt").limit(5),
    sb.from("collection_points").select("*").eq("communityId", me.communityId).order("name"),
    isAdmin ? sb.from("profiles").select("id, name, avatar, memberId, active, points, role").eq("communityId", me.communityId).order("points", { ascending: false }) : null,
  ]);
  const list = members?.data ?? [];
  const activeMembers = list.filter((m) => m.active).length;
  const pct = Math.min(100, Math.round((month.kg / COMMUNITY_GOAL_KG) * 100));
  const campaigns = withDates(events.data, "startsAt");

  return (
    <>
      <Header title={community.data?.name ?? "My Community"} back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        {isAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Users size={20} className="text-leaf" />} value={list.length} label="Registered members" />
            <Stat icon={<Recycle size={20} className="text-leaf" />} value={`${month.kg} kg`} label="Collected this month" />
            <Stat value={`${month.recyclingRate}%`} label="Recycling rate" />
          </div>
        )}
        <section className="card p-4">
          <h2 className="text-sm font-medium">Community progress</h2>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-3xl font-semibold">{pct}%</p>
            <div className="h-2 flex-1 rounded-full bg-panel"><div className="grow-x h-2 rounded-full bg-leaf" style={{ width: `${pct}%` }} /></div>
          </div>
          <p className="mt-1 text-xs text-white/50">{month.kg} of {COMMUNITY_GOAL_KG} kg monthly goal · {month.co2} kg CO₂ avoided · {month.water} L water saved</p>
          {isAdmin && <p className="mt-1 text-xs text-white/50">{activeMembers} of {list.length} members active</p>}
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">Local campaigns</h2><Link href="/events" className="text-xs text-leaf">All events →</Link></div>
          <ul className="space-y-2 text-sm">
            {campaigns.map((e) => <li key={e.id} className="flex gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-leaf" /><span className="flex-1">{e.title}<span className="block text-xs text-white/50">{e.startsAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {e.location}</span></span></li>)}
            {campaigns.length === 0 && <li className="text-xs text-white/50">No upcoming campaigns{isAdmin ? " — create one in Events & Campaigns." : "."}</li>}
          </ul>
        </section>

        <section id="points" className="card scroll-mt-20 p-4">
          <h2 className="mb-2 text-sm font-medium">Collection points</h2>
          <ul className="space-y-2 text-sm">
            {(points.data ?? []).map((p) => (
              <li key={p.id} className={`flex items-center gap-2 ${p.active ? "" : "opacity-50"}`}>
                <MapPin size={16} className="shrink-0 text-leaf" />
                <span className="flex-1">{p.name}<span className="block text-xs text-white/50">{[p.address, p.accepts].filter(Boolean).join(" · ")}</span></span>
                {isAdmin && <form action={toggleCollectionPoint.bind(null, p.id)}><button className="chip">{p.active ? "Close" : "Reopen"}</button></form>}
              </li>
            ))}
            {(points.data ?? []).length === 0 && <li className="text-xs text-white/50">No collection points yet. See <Link href="/partners" className="text-leaf">Recycling Partners</Link>.</li>}
          </ul>
        </section>

        {isAdmin && (
          <>
            <ActionForm action={addCollectionPoint} submit="Add collection point">
              <h2 className="text-sm font-medium">Add a collection point</h2>
              <input name="name" required maxLength={80} placeholder="Name, e.g. Park Gate Bins" aria-label="Collection point name" className="input" />
              <input name="address" maxLength={120} placeholder="Address" aria-label="Address" className="input" />
              <input name="accepts" maxLength={160} placeholder="Accepts, e.g. plastic, cans, glass" aria-label="Accepts" className="input" />
            </ActionForm>
            <ActionForm id="announce" action={announceToCommunity} submit="Send to community">
              <h2 className="text-sm font-medium">Announcement</h2>
              <select name="kind" aria-label="Type" className="input"><option value="ANNOUNCEMENT">Announcement</option><option value="PICKUP">Collection reminder</option><option value="EVENT">Event</option><option value="CHALLENGE">Challenge</option></select>
              <input name="title" required maxLength={80} placeholder="Title" aria-label="Title" className="input" />
              <textarea name="body" required maxLength={280} rows={2} placeholder="Message" aria-label="Message" className="input" />
            </ActionForm>
            <section className="card overflow-hidden">
              <h2 className="px-4 pt-4 text-sm font-medium">Manage members</h2>
              <ul>
                {list.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
                    <span className="text-xl">{m.avatar}</span>
                    <span className="min-w-0 flex-1"><span className={m.active ? "" : "text-white/40 line-through"}>{m.name}</span><span className="block text-xs text-white/50">{m.memberId} · {m.points} pts</span></span>
                    {m.role === "COMMUNITY" && <form action={toggleCommunityMember.bind(null, m.id)}><button className={`chip ${m.active ? "" : "chip-on"}`}>{m.active ? "Suspend" : "Reactivate"}</button></form>}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}
