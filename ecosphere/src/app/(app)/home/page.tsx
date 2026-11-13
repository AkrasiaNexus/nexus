import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Bell, BookOpen, CalendarDays, ClipboardCheck, Droplets, Gift, Globe2, HeartPulse, Handshake, Leaf, Lock, Recycle, ScanLine, School, ShieldCheck, ShoppingBag, Trash2, Utensils } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactFor, scanScope, startOf } from "@/lib/queries";
import { goalPercent } from "@/lib/rewards";
import { GUIDE } from "@/lib/waste";
import { Ring, Stat } from "@/components/ui";

const SCOPE_LABEL: Record<string, string> = { me: "My impact", class: "My class", school: "My school", PARENT: "My children", TEACHER: "My class", HEALTH_MONITOR: "My class", SCHOOL_ADMIN: "My school", SUPER_ADMIN: "Whole platform" };
const TIPS: Record<string, string> = {
  PLASTIC: "Most of your waste is plastic. A reusable bottle avoids ~150 bottles a year.",
  PAPER: "Lots of paper! Try printing double-sided and reusing one-sided sheets.",
  GLASS: "Glass jars make great storage. Reuse before you recycle.",
  METAL: "Cans are endlessly recyclable. Rinse and squash them.",
  ORGANIC: "Food scraps add up. Plan portions and compost the rest.",
  EWASTE: "Repair before you replace. Check the Repair Café in Partners.",
  TEXTILE: "Swap clothes at the next community event instead of buying new.",
  OTHER: "Much of your waste can't be recycled yet. Look for products with less packaging.",
};

export default async function Home({ searchParams }: { searchParams: { s?: string } }) {
  const user = await requireUser();
  const isStudent = user.role === "STUDENT";
  const isPersonal = ["STUDENT", "EMPLOYEE", "COMMUNITY"].includes(user.role);
  const view = isStudent && ["class", "school"].includes(searchParams.s ?? "") ? searchParams.s! : "me";
  const scope: Prisma.ScanWhereInput = view === "class" ? { user: { schoolId: user.schoolId, grade: user.grade } }
    : view === "school" ? { user: { schoolId: user.schoolId } } : scanScope(user);
  const personalGoal = isPersonal && view === "me";
  const now = new Date();
  const inAWeek = new Date(Date.now() + 7 * 86_400_000);

  const [month, unread, challenge, tasks, events, top] = await Promise.all([
    impactFor(scope, startOf("month")),
    db.notification.count({ where: { OR: [{ userId: user.id }, { userId: null }], createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } } }),
    db.challenge.findFirst({ where: { endsAt: { gte: now } }, orderBy: { endsAt: "asc" } }),
    isStudent ? db.task.findMany({ where: { schoolId: user.schoolId ?? "", className: user.grade ?? "", dueAt: { gte: now }, dones: { none: { userId: user.id } } }, orderBy: { dueAt: "asc" }, take: 3 }) : [],
    db.event.findMany({ where: { startsAt: { gte: now, lte: inAWeek }, rsvps: { some: { userId: user.id } } }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.scan.groupBy({ by: ["wasteType"], where: { userId: user.id }, _sum: { weightKg: true }, orderBy: { _sum: { weightKg: "desc" } }, take: 1 }),
  ]);
  const percent = personalGoal ? goalPercent(month.kg) : month.recyclingRate;
  const tip = top[0] ? TIPS[top[0].wasteType] : "Scan your first item to get personalised eco-tips.";

  const actions = [
    { href: "/scan", label: "Scan Waste", icon: ScanLine },
    { href: "/guide", label: "Guide", icon: BookOpen },
    { href: "/food", label: "Food Waste", icon: Utensils },
    { href: "/marketplace", label: "Market", icon: ShoppingBag },
    { href: "/rewards", label: "Rewards", icon: Gift },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/impact", label: "SDG Impact", icon: Globe2 },
    { href: "/partners", label: "Partners", icon: Handshake },
    ...(isStudent ? [{ href: "/tasks", label: "Tasks", icon: ClipboardCheck }] : []),
    ...(["STUDENT", "PARENT", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN"].includes(user.role) ? [{ href: "/health", label: "Health", icon: HeartPulse }] : []),
    ...(user.role === "TEACHER" ? [{ href: "/teacher", label: "My Class", icon: School }] : []),
    ...(user.role === "SCHOOL_ADMIN" ? [{ href: "/school", label: "School", icon: School }] : []),
    ...(user.role === "SUPER_ADMIN" ? [{ href: "/admin/users", label: "Admin", icon: ShieldCheck }] : []),
    { href: "/privacy", label: "Privacy", icon: Lock },
  ];
  const reminders = [
    ...tasks.map((t) => ({ href: "/tasks", text: `Task due ${t.dueAt.toLocaleDateString()}: ${t.title}` })),
    ...events.map((e) => ({ href: "/events", text: `You're going: ${e.title} · ${e.startsAt.toLocaleDateString()}` })),
    ...(challenge && challenge.endsAt < inAWeek ? [{ href: "/rewards", text: `Challenge "${challenge.title}" ends ${challenge.endsAt.toLocaleDateString()}` }] : []),
  ];

  return (
    <div className="flex flex-col gap-5 px-5 pt-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-2xl">{user.avatar}</span>
        <div className="flex-1">
          <p className="text-sm text-mute">Welcome back,</p>
          <p className="text-lg font-semibold">{user.name.split(" ")[0]}!</p>
        </div>
        <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-card">
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-leaf" />}
        </Link>
      </div>

      {isStudent && (
        <nav className="flex justify-center gap-2" aria-label="Dashboard scope">
          {[["me", "Me"], ["class", "My Class"], ["school", "School"]].map(([k, v]) => <Link key={k} href={`/home?s=${k}`} className={`chip ${k === view ? "chip-on" : ""}`}>{v}</Link>)}
        </nav>
      )}

      <section className="card relative overflow-hidden p-5 text-center">
        <p className="mb-2 text-xs uppercase tracking-wide text-mute">{SCOPE_LABEL[isPersonal ? view : user.role]} · this month{user.school ? ` · ${user.school.name}` : ""}</p>
        <Ring percent={percent} label={personalGoal ? "Green Goal" : "Recycling Rate"} />
        <p className="mt-2 text-xs text-mute">{personalGoal ? `${month.kg} of 20 kg monthly goal` : `${month.scans.length} items sorted`}</p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Trash2 size={18} />} value={`${month.kg} kg`} label="Waste Reduced" />
        <Stat icon={<Leaf size={18} />} value={`${month.co2} kg`} label="CO₂ Avoided" />
        <Stat icon={<Droplets size={18} />} value={`${month.water} L`} label="Water Saved" />
      </div>

      {reminders.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell size={16} className="text-leaf" />Reminders</h2>
          <ul className="space-y-1 text-sm">{reminders.map((r) => <li key={r.text}><Link href={r.href} className="text-mute hover:text-white">• {r.text}</Link></li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="card flex flex-col items-center gap-2 p-3 text-center text-[11px] hover:border-leaf">
              <Icon className="text-leaf" size={22} />{label}
            </Link>
          ))}
        </div>
      </section>

      {challenge && (
        <Link href="/rewards" className="card flex items-center gap-3 p-4 hover:border-leaf">
          <Recycle className="text-leaf" />
          <div className="flex-1">
            <p className="text-sm font-medium">Challenge: {challenge.title}</p>
            <p className="text-xs text-mute">{GUIDE[challenge.wasteType].emoji} +{challenge.rewardPoints} pts · ends {challenge.endsAt.toLocaleDateString()}</p>
          </div>
        </Link>
      )}

      <section className="card flex gap-3 p-4">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-sm font-medium text-leaf">Your personalised eco-tip</p>
          <p className="text-sm text-mute">{tip}</p>
        </div>
      </section>
    </div>
  );
}
