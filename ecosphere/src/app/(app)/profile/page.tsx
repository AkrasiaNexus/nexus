import Link from "next/link";
import { Activity, Award, Bell, Building2, CalendarDays, ChevronRight, ClipboardCheck, ClipboardList, Crown, FileBarChart, HeartPulse, Leaf, MapPin, School, ScrollText, Settings, SlidersHorizontal, Star, Trash2, Trophy, Users, UsersRound } from "lucide-react";
import type { Role, User } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailySeries, impactFor, scanScope, startOf } from "@/lib/queries";
import { LeafDecor } from "@/components/art";
import { Bars, Header, IconCircle, MenuRow, Stat } from "@/components/ui";

const ROLE_NAME: Record<Role, string> = {
  STUDENT: "Student", PARENT: "Parent", EMPLOYEE: "Employee", SCHOOL_ADMIN: "School Administrator", COMMUNITY: "Community Member",
  SUPER_ADMIN: "Super Administrator", TEACHER: "Teacher", HEALTH_MONITOR: "Health Monitor",
};
const TITLE: Record<Role, string> = {
  STUDENT: "Student Profile", PARENT: "Parent Profile", EMPLOYEE: "Employee Profile", SCHOOL_ADMIN: "School Admin Profile", COMMUNITY: "Community Profile",
  SUPER_ADMIN: "Super Admin Profile", TEACHER: "Teacher Profile", HEALTH_MONITOR: "Health Monitor Profile",
};
const COMMUNITY_GOAL_KG = 100; // monthly target for a community's collective sorting
const ICON = 20;

type Me = User & { school: { name: string } | null };

export default async function Profile() {
  const user = await requireUser();
  const subtitle =
    user.role === "STUDENT" ? [user.grade, user.school?.name].filter(Boolean).join(" • ")
    : user.role === "EMPLOYEE" ? ["Employee", user.department].filter(Boolean).join(" • ")
    : ["TEACHER", "HEALTH_MONITOR"].includes(user.role) ? [ROLE_NAME[user.role], user.grade, user.school?.name].filter(Boolean).join(" • ")
    : ROLE_NAME[user.role];
  const emblem = { SCHOOL_ADMIN: <School size={56} className="text-leaf" />, COMMUNITY: <UsersRound size={56} className="text-leaf" />, SUPER_ADMIN: <Crown size={56} className="text-gold" fill="currentColor" /> }[user.role as string];

  return (
    <div className="relative isolate">
      <LeafDecor />
      <Header title={TITLE[user.role]} />
      <div className="flex flex-col gap-4 px-5">
        <section className="flex flex-col items-center gap-1 text-center">
          {emblem ?? <span className="grid h-28 w-28 place-items-center rounded-full border-4 border-leaf/40 bg-[#cfd8d2] text-6xl">{user.avatar}</span>}
          <h2 className="mt-2 text-2xl font-semibold">{user.name}</h2>
          <p className="text-white/65">{subtitle}</p>
        </section>
        <RoleBody user={user} />
      </div>
    </div>
  );
}

const Menu = ({ items }: { items: { href: string; icon: React.ReactNode; label: string }[] }) => (
  <nav className="card overflow-hidden">{items.map((m) => <MenuRow key={m.href + m.label} {...m} />)}</nav>
);
const settings = { href: "/settings", icon: <Settings size={ICON} />, label: "Settings" };

async function RoleBody({ user }: { user: Me }) {
  const scope = scanScope(user);

  if (user.role === "STUDENT") {
    const [joined, week] = await Promise.all([db.challengeJoin.count({ where: { userId: user.id } }), impactFor(scope, startOf("week"))]);
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Star size={24} className="text-leaf" />} value={user.points} label="Points" />
          <Stat icon={<Trophy size={24} className="text-white/80" />} value={joined} label="Challenges" />
        </div>
        <section className="card p-4">
          <h3 className="mb-3 flex items-center justify-between text-sm font-medium">Your Progress <Leaf size={14} className="text-leaf" /></h3>
          <Bars data={dailySeries(week.scans)} />
        </section>
        <Menu items={[
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Class Reports" },
          { href: "/rewards?all=1", icon: <Award size={ICON} />, label: "Achievements" },
          { href: "/rewards", icon: <SlidersHorizontal size={ICON} />, label: "Customisation" },
          { href: "/tasks", icon: <ClipboardCheck size={ICON} />, label: "Class Tasks" },
          { href: "/history", icon: <Activity size={ICON} />, label: "Activity History" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "PARENT") {
    const children = await db.user.findMany({ where: { parentId: user.id }, select: { id: true, name: true, grade: true } });
    const month = await impactFor(scope, startOf("month"));
    return (
      <>
        <nav className="card overflow-hidden">
          <Link href="/child" className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-panel">
            <IconCircle><Leaf size={22} /></IconCircle>
            <span className="flex-1">
              <span className="block text-sm font-medium">Child Progress</span>
              <span className="text-xs text-white/60">{children.length ? children.map((c) => `${c.name} • ${c.grade}`).join(", ") : "Link your child"}</span>
            </span>
            <ChevronRight size={16} className="text-white/50" />
          </Link>
          <MenuRow href="/stats" icon={<FileBarChart size={ICON} />} label="Child's Reports" />
          <MenuRow href="/notifications" icon={<Bell size={ICON} />} label="Notifications" />
          <MenuRow href="/events" icon={<CalendarDays size={ICON} />} label="Upcoming Events" />
          <MenuRow {...settings} />
        </nav>
        <section className="card p-4">
          <h3 className="text-sm font-medium">Recycling Activity</h3>
          <div className="flex items-end gap-4">
            <p className="text-3xl font-semibold">{month.recyclingRate}%</p>
            <div className="flex-1"><Bars height="h-12" data={dailySeries(month.scans, 14).map((d) => ({ ...d, label: "" }))} /></div>
          </div>
        </section>
      </>
    );
  }

  if (user.role === "EMPLOYEE") {
    const all = await impactFor(scope);
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Trash2 size={24} className="text-gold" />} value={`${all.kg} kg`} label="Waste Reduced" />
          <Stat icon={<Leaf size={24} className="text-leaf" />} value={`${user.points} pts`} label="Green Points" />
        </div>
        <Menu items={[
          { href: "/department", icon: <Users size={ICON} />, label: "My Department" },
          { href: "/history?t=Scan", icon: <ClipboardList size={ICON} />, label: "Waste Records" },
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Reports" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "SCHOOL_ADMIN") {
    const [students, classes, all] = await Promise.all([
      db.user.count({ where: { schoolId: user.schoolId, role: "STUDENT" } }),
      db.user.groupBy({ by: ["grade"], where: { schoolId: user.schoolId, role: "STUDENT" } }),
      impactFor(scope),
    ]);
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={students} label="Students" /><Stat value={classes.length} label="Classes" /><Stat value={`${all.kg} kg`} label="Waste Recycled" /></div>
        <Menu items={[
          { href: "/school", icon: <FileBarChart size={ICON} />, label: "School Reports" },
          { href: "/school/classes", icon: <Users size={ICON} />, label: "Manage Classes" },
          { href: "/school/staff", icon: <UsersRound size={ICON} />, label: "Manage Staff" },
          { href: "/health", icon: <HeartPulse size={ICON} />, label: "Health & Safety" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "COMMUNITY") {
    const [all, community] = await Promise.all([
      impactFor(scope),
      impactFor({ user: { role: "COMMUNITY", ...(user.community && { community: user.community }) } }, startOf("month")),
    ]);
    const pct = Math.min(100, Math.round((community.kg / COMMUNITY_GOAL_KG) * 100));
    return (
      <>
        <div className="grid grid-cols-2 gap-3"><Stat value={user.points} label="Points" /><Stat value={all.scans.length} label="Activities" /></div>
        <section className="card p-4">
          <h3 className="text-sm font-medium">Community Progress</h3>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-semibold">{pct}%</p>
            <div className="h-2 flex-1 rounded-full bg-panel"><div className="h-2 rounded-full bg-leaf" style={{ width: `${pct}%` }} /></div>
          </div>
          <p className="mt-1 text-xs text-white/50">{community.kg} of {COMMUNITY_GOAL_KG} kg monthly community goal</p>
        </section>
        <Menu items={[
          { href: "/partners", icon: <MapPin size={ICON} />, label: "Nearby Recycling Centres" },
          { href: "/events", icon: <CalendarDays size={ICON} />, label: "Community Events" },
          { href: "/history", icon: <Activity size={ICON} />, label: "My Activities" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "SUPER_ADMIN") {
    const [users, schools, all] = await Promise.all([db.user.count(), db.school.count(), impactFor({})]);
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={users} label="Users" /><Stat value={schools} label="Schools" /><Stat value={`${all.kg} kg`} label="Waste Reduced" /></div>
        <Menu items={[
          { href: "/admin/users", icon: <Users size={ICON} />, label: "Manage Users" },
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Platform Analytics" },
          { href: "/admin/system", icon: <Settings size={ICON} />, label: "System Settings" },
          { href: "/admin/audit", icon: <ScrollText size={ICON} />, label: "Audit Logs" },
          { href: "/settings", icon: <SlidersHorizontal size={ICON} />, label: "My Account" },
        ]} />
      </>
    );
  }

  // Teacher / Health Monitor
  const [students, all] = await Promise.all([db.user.count({ where: { schoolId: user.schoolId, grade: user.grade, role: "STUDENT" } }), impactFor(scope)]);
  return (
    <>
      <div className="grid grid-cols-3 gap-3"><Stat value={user.grade ?? "—"} label="Class" /><Stat value={students} label="Students" /><Stat value={`${all.kg} kg`} label="Class Waste" /></div>
      <Menu items={user.role === "TEACHER" ? [
        { href: "/teacher", icon: <Building2 size={ICON} />, label: "My Class & Tasks" },
        { href: "/health", icon: <HeartPulse size={ICON} />, label: "Classroom Health & Safety" },
        { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Class Reports" },
        settings,
      ] : [
        { href: "/health", icon: <HeartPulse size={ICON} />, label: "Daily Health Report & Incidents" },
        { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Class Waste Levels" },
        settings,
      ]} />
    </>
  );
}
