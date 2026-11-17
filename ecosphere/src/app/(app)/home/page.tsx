import Link from "next/link";
import { BarChart3, Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Cloud, Droplet, Gift, Globe2, Handshake, HeartPulse, Megaphone, ScanLine, School, ShieldCheck, Store, Trash2, Trophy, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PERIOD_GOAL_KG, periodLabel, periodRange, type Period } from "@/lib/charts";
import { impactFor, scanScope, withDates, type Scope } from "@/lib/queries";
import { goalPercent } from "@/lib/rewards";
import { LeafGoal } from "@/components/LeafGoal";
import { PillMenu, Stat } from "@/components/ui";

const SCOPE_LABEL: Record<string, string> = { PARENT: "My Children", TEACHER: "My Class", HEALTH_MONITOR: "My Class", SCHOOL_ADMIN: "My School", SUPER_ADMIN: "Platform", EMPLOYEE: "Me", COMMUNITY: "Me" };
const TIPS: Record<string, string> = {
  PLASTIC: "Most of your waste is plastic. A reusable bottle avoids ~150 bottles a year.",
  PAPER: "Lots of paper! Print double-sided and reuse one-sided sheets.",
  GLASS: "Glass jars make great storage. Reuse before you recycle.",
  METAL: "Cans are endlessly recyclable. Rinse and squash them.",
  ORGANIC: "Food scraps add up. Plan portions and compost the rest.",
  EWASTE: "Repair before you replace. Check the Repair Café in Partners.",
  TEXTILE: "Swap clothes at the next community event instead of buying new.",
  OTHER: "Much of your waste can't be recycled yet. Look for products with less packaging.",
};
const PERIODS: Period[] = ["week", "month", "year"];
const SLIDER_STEPS = 4; // how far back the timeline slider goes

type Params = { s?: string; p?: string; o?: string };

export default async function Home({ searchParams }: { searchParams: Params }) {
  const user = await requireUser();
  const isStudent = user.role === "STUDENT";
  const isPersonal = ["STUDENT", "EMPLOYEE", "COMMUNITY"].includes(user.role);
  const view = isStudent && ["class", "school"].includes(searchParams.s ?? "") ? searchParams.s! : "me";
  const period: Period = PERIODS.includes(searchParams.p as Period) ? (searchParams.p as Period) : "month";
  const offset = Math.max(-(SLIDER_STEPS - 1), Math.min(0, Number(searchParams.o) || 0));
  const url = (q: Params) => `/home?${new URLSearchParams({ s: view, p: period, o: String(offset), ...q })}`;

  const scope: Scope = view === "class" ? "class" : view === "school" ? "school" : scanScope(user);
  const { start, end } = periodRange(period, offset);
  const personalGoal = isPersonal && view === "me";
  const now = new Date();
  const inAWeek = new Date(Date.now() + 7 * 86_400_000);
  const sb = createClient();

  const [data, unread, taskRes, doneRes, rsvpRes, challengeRes, myScans] = await Promise.all([
    impactFor(scope, start, end),
    sb.from("notifications").select("id", { count: "exact", head: true }).or(`userId.eq.${user.id},userId.is.null`).gte("createdAt", new Date(Date.now() - 2 * 86_400_000).toISOString()),
    isStudent ? sb.from("tasks").select("id, title, dueAt").eq("schoolId", user.schoolId ?? "").eq("className", user.grade ?? "").gte("dueAt", now.toISOString()).order("dueAt").limit(10) : null,
    sb.from("task_dones").select("taskId").eq("userId", user.id),
    sb.from("event_rsvps").select("event:events(id, title, startsAt)").eq("userId", user.id),
    sb.from("challenges").select("title, endsAt").gte("endsAt", now.toISOString()).lte("endsAt", inAWeek.toISOString()).order("endsAt").limit(1).maybeSingle(),
    sb.from("scans").select("wasteType, weightKg").eq("userId", user.id),
  ]);
  const [announceRes, recentScans, recentBuys] = await Promise.all([
    sb.from("notifications").select("id, title, body, createdAt").eq("kind", "ANNOUNCEMENT").or(`userId.eq.${user.id},userId.is.null`).order("createdAt", { ascending: false }).limit(2),
    sb.from("scans").select("id, label, points, createdAt").eq("userId", user.id).order("createdAt", { ascending: false }).limit(3),
    sb.from("purchases").select("id, points, createdAt, listing:listings(title)").eq("userId", user.id).order("createdAt", { ascending: false }).limit(2),
  ]);
  const announcements = withDates(announceRes.data, "createdAt");
  const recent = [
    ...withDates(recentScans.data, "createdAt").map((x) => ({ id: x.id, at: x.createdAt, text: `Scanned ${x.label}`, pts: `+${x.points}` })),
    ...withDates(recentBuys.data, "createdAt").map((x) => ({ id: x.id, at: x.createdAt, text: `Redeemed ${(Array.isArray(x.listing) ? x.listing[0] : x.listing)?.title ?? "an item"}`, pts: x.points ? `-${x.points}` : "" })),
  ].sort((a, b) => +b.at - +a.at).slice(0, 4);
  const done = new Set((doneRes.data ?? []).map((d) => d.taskId));
  const tasks = withDates(taskRes?.data ?? [], "dueAt").filter((t) => !done.has(t.id)).slice(0, 3);
  const events = withDates((rsvpRes.data ?? []).flatMap((r) => (Array.isArray(r.event) ? r.event : r.event ? [r.event] : [])), "startsAt")
    .filter((e) => e.startsAt >= now && e.startsAt <= inAWeek).sort((a, b) => +a.startsAt - +b.startsAt).slice(0, 3);
  const challenge = challengeRes.data ? { ...challengeRes.data, endsAt: new Date(challengeRes.data.endsAt) } : null;
  const totals = (myScans.data ?? []).reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.wasteType]: (acc[x.wasteType] ?? 0) + x.weightKg }), {});
  const top = Object.entries(totals).sort((x, y) => y[1] - x[1]).slice(0, 1).map(([wasteType]) => ({ wasteType }));
  const unreadCount = unread.count ?? 0;
  const percent = personalGoal ? goalPercent(data.kg, PERIOD_GOAL_KG[period]) : data.recyclingRate;

  // First three match the mockup; the rest scroll sideways.
  const actions = [
    { href: "/scan", label: "Scan Waste", icon: ScanLine },
    { href: "/stats", label: "Statistics", icon: BarChart3 },
    { href: "/guide", label: "Recycling Guide", icon: BookOpen },
    { href: "/rewards", label: "Green Points", icon: Gift },
    { href: "/marketplace", label: "Marketplace", icon: Store },
    { href: "/challenges", label: "Challenges", icon: Trophy },
    ...(isStudent ? [{ href: "/tasks", label: "Tasks", icon: ClipboardCheck }] : []),
    ...(user.role === "TEACHER" ? [{ href: "/teacher", label: "My Class", icon: School }] : []),
    ...(user.role === "SCHOOL_ADMIN" ? [{ href: "/school", label: "School", icon: School }] : []),
    ...(user.role === "SUPER_ADMIN" ? [{ href: "/admin/users", label: "Admin", icon: ShieldCheck }] : []),
    ...(["STUDENT", "PARENT", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN"].includes(user.role) ? [{ href: "/health", label: "Health", icon: HeartPulse }] : []),
    ...(["COMMUNITY", "COMMUNITY_ADMIN"].includes(user.role) ? [{ href: "/community", label: "Community", icon: Users }] : []),
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/impact", label: "SDG Impact", icon: Globe2 },
    { href: "/partners", label: "Partners", icon: Handshake },
  ];
  const reminders = [
    ...tasks.map((t) => ({ href: "/tasks", text: `Task due ${t.dueAt.toLocaleDateString()}: ${t.title}` })),
    ...events.map((e) => ({ href: "/events", text: `You're going: ${e.title} · ${e.startsAt.toLocaleDateString()}` })),
    ...(challenge ? [{ href: "/challenges", text: `Challenge "${challenge.title}" ends ${challenge.endsAt.toLocaleDateString()}` }] : []),
  ];
  const scopeItems = [["me", "Me"], ["class", "My Class"], ["school", "School"]].map(([k, v]) => ({ href: url({ s: k }), label: v, on: k === view }));

  return (
    <div className="px-5 pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-white/15 bg-card text-3xl">{user.avatar}</span>
        <p className="flex-1 text-lg leading-tight">Welcome back,<br /><b className="font-semibold">{user.name.split(" ")[0]}!</b></p>
        <Link href="/notifications" aria-label={`Notifications${unreadCount ? ` (${unreadCount} new)` : ""}`} className="relative rounded-full p-2 hover:bg-card">
          <Bell size={24} />
          {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-leaf" />}
        </Link>
      </div>

      <div className="-mt-1 flex justify-center">
        {isStudent
          ? <PillMenu label={scopeItems.find((i) => i.on)!.label} items={scopeItems} />
          : <span className="rounded-xl border border-white/[.06] bg-card px-4 py-2 text-sm">{SCOPE_LABEL[user.role]}{user.school ? ` · ${user.school.name}` : ""}</span>}
      </div>

      <LeafGoal percent={percent} label={personalGoal ? "Green Goal" : "Recycling Rate"} />
      {isPersonal && <Link href="/rewards" className="-mt-3 self-center text-sm text-white/60"><b className="text-leaf">{user.points}</b> green points</Link>}

      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center gap-3" aria-label="Timeline">
          <Link href={url({ o: String(Math.max(-(SLIDER_STEPS - 1), offset - 1)) })} aria-label="Earlier" className="grid h-9 w-9 place-items-center rounded-full border border-leaf/40 bg-card text-leaf"><ChevronLeft size={18} /></Link>
          <div className="relative flex flex-1 items-center justify-between">
            <span className="absolute inset-x-0 h-0.5 bg-leaf/30" />
            {Array.from({ length: SLIDER_STEPS }, (_, i) => i - (SLIDER_STEPS - 1)).map((o) => (
              <Link key={o} href={url({ o: String(o) })} aria-label={`Go to ${o === 0 ? "current" : `${-o} back`}`}
                className={`relative rounded-full ${o === offset ? "h-3.5 w-3.5 bg-leaf ring-4 ring-leaf/25" : "h-2.5 w-2.5 bg-leaf/60"}`} />
            ))}
          </div>
          <Link href={url({ o: String(Math.min(0, offset + 1)) })} aria-label="Later" className="grid h-9 w-9 place-items-center rounded-full border border-leaf/40 bg-card text-leaf"><ChevronRight size={18} /></Link>
        </div>
        <PillMenu label={periodLabel(period, offset, start)} className="[&>summary]:border-0 [&>summary]:bg-transparent [&>summary]:text-base"
          items={PERIODS.map((p) => ({ href: url({ p, o: "0" }), label: periodLabel(p, 0, start), on: p === period }))} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Trash2 size={22} className="text-gold" />} value={`${data.kg} kg`} label="Waste Reduced" />
        <Stat icon={<Cloud size={22} className="text-[#7fe0c4]" />} value={`${data.co2} kg`} label="CO₂ Avoided" />
        <Stat icon={<Droplet size={22} className="text-leaf" />} value={`${data.water} L`} label="Water Saved" />
      </div>
    </div>

    <div className="mt-5 flex flex-col gap-5 lg:mt-0">

      <section>
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="stagger -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="card flex w-[calc((100%-1.5rem)/3)] shrink-0 snap-start flex-col items-center gap-2 py-4 text-center text-xs hover:border-leaf lg:w-auto">
              <Icon className="text-leaf" size={28} />{label}
            </Link>
          ))}
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell size={16} className="text-leaf" />Upcoming</h2>
          <ul className="space-y-1 text-sm">{reminders.map((r) => <li key={r.text}><Link href={r.href} className="text-white/65 hover:text-white">• {r.text}</Link></li>)}</ul>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><Megaphone size={16} className="text-leaf" />Announcements</h2>
          <ul className="space-y-2 text-sm">
            {announcements.map((a) => <li key={a.id}><p>{a.title}</p><p className="text-xs text-white/50">{a.body}</p></li>)}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">Recent activity</h2><Link href="/history" className="text-xs text-leaf">All →</Link></div>
          <ul className="space-y-1.5 text-sm">
            {recent.map((r) => <li key={r.id} className="flex gap-2"><span className="flex-1 truncate capitalize text-white/75">{r.text}</span><span className={r.pts.startsWith("-") ? "text-orange-300" : "text-leaf"}>{r.pts}</span></li>)}
          </ul>
        </section>
      )}

      <section className="card flex gap-3 p-4">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-sm font-medium text-leaf">Your eco-tip</p>
          <p className="text-sm text-white/65">{top[0] ? TIPS[top[0].wasteType] : "Scan your first item to get personalised eco-tips."}</p>
        </div>
      </section>
    </div>
    </div>
  );
}
