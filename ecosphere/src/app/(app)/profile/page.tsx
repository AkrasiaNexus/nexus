import Link from "next/link";
import { Activity, Award, Bell, Building2, CalendarDays, ChevronRight, ClipboardCheck, ClipboardList, Crown, FileBarChart, HeartPulse, Leaf, MapPin, School, ScrollText, Settings, SlidersHorizontal, Star, Trash2, Trophy, Users, UsersRound, Megaphone, Sprout, Store } from "lucide-react";
import type { Role } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cosmeticsFor, dailySeries, impactFor, scanScope, startOf } from "@/lib/queries";
import { Avatar } from "@/components/Avatar";
import { LeafDecor } from "@/components/art";
import { Bars, Header, IconCircle, MenuRow, Stat } from "@/components/ui";

const ROLE_NAME: Record<Role, string> = {
  STUDENT: "Student", PARENT: "Parent", EMPLOYEE: "Employee", SCHOOL_ADMIN: "School Administrator", COMMUNITY: "Community Member",
  SUPER_ADMIN: "Super Administrator", TEACHER: "Teacher", HEALTH_MONITOR: "Health Monitor", COMMUNITY_ADMIN: "Community Admin",
};
const TITLE: Record<Role, string> = {
  STUDENT: "Student Profile", PARENT: "Parent Profile", EMPLOYEE: "Employee Profile", SCHOOL_ADMIN: "School Admin Profile", COMMUNITY: "Community Profile",
  SUPER_ADMIN: "Super Admin Profile", TEACHER: "Teacher Profile", HEALTH_MONITOR: "Health Monitor Profile", COMMUNITY_ADMIN: "Community Admin Profile",
};
const COMMUNITY_GOAL_KG = 100; // monthly target for a community's collective sorting
const ICON = 20;

type Me = CurrentUser;

export default async function Profile() {
  const user = await requireUser();
  const cosmetics = await cosmeticsFor(user);
  const subtitle =
    user.role === "STUDENT" ? [user.grade, user.school?.name].filter(Boolean).join(" • ")
    : user.role === "EMPLOYEE" ? ["Employee", user.department].filter(Boolean).join(" • ")
    : ["TEACHER", "HEALTH_MONITOR"].includes(user.role) ? [ROLE_NAME[user.role], user.grade, user.school?.name].filter(Boolean).join(" • ")
    : ["COMMUNITY", "COMMUNITY_ADMIN"].includes(user.role) ? [ROLE_NAME[user.role], user.community].filter(Boolean).join(" • ")
    : ROLE_NAME[user.role];
  const emblem = { SCHOOL_ADMIN: <School size={56} className="text-leaf" />, COMMUNITY: <UsersRound size={56} className="text-leaf" />, COMMUNITY_ADMIN: <Sprout size={56} className="text-leaf" />, SUPER_ADMIN: <Crown size={56} className="text-gold" fill="currentColor" /> }[user.role as string];

  return (
    <div className="relative isolate">
      <LeafDecor />
      <Header title={TITLE[user.role]} />
      <div className="stagger flex flex-col gap-4 px-5">
        <section className="flex flex-col items-center gap-1 text-center">
          <span className="pop-in">{emblem ?? <Avatar emoji={user.avatar} size={112} cosmetics={cosmetics} />}</span>
          <h2 className="mt-2 text-2xl font-semibold" style={{ animation: "rise-in 600ms 200ms var(--ease-out) both" }}>{user.name}</h2>
          <p className="text-white/65" style={{ animation: "rise-in 600ms 300ms var(--ease-out) both" }}>{subtitle}</p>
          <p className="font-mono text-xs text-white/40" style={{ animation: "rise-in 600ms 380ms var(--ease-out) both" }}>ID {user.memberId}</p>
        </section>
        <RoleBody user={user} />
      </div>
    </div>
  );
}

const Menu = ({ items }: { items: { href: string; icon: React.ReactNode; label: string }[] }) => (
  <nav className="stagger card overflow-hidden">{items.map((m) => <MenuRow key={m.href + m.label} {...m} />)}</nav>
);
const settings = { href: "/settings", icon: <Settings size={ICON} />, label: "Settings" };

async function RoleBody({ user }: { user: Me }) {
  const scope = scanScope(user);

  if (user.role === "STUDENT") {
    const [{ count: joinedCount }, week] = await Promise.all([createClient().from("challenge_joins").select("userId", { count: "exact", head: true }).eq("userId", user.id), impactFor(scope, startOf("week"))]);
    const joined = joinedCount ?? 0;
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
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "My Class Reports" },
          { href: "/home?s=school", icon: <School size={ICON} />, label: "School Environmental Progress" },
          { href: "/rewards?all=1", icon: <Award size={ICON} />, label: "Achievements" },
          { href: "/history?t=Rewards", icon: <Trophy size={ICON} />, label: "Completed Challenges" },
          { href: "/rewards", icon: <SlidersHorizontal size={ICON} />, label: "Rewards & Customisation" },
          { href: "/tasks", icon: <ClipboardCheck size={ICON} />, label: "Class Tasks" },
          { href: "/history", icon: <Activity size={ICON} />, label: "Activity History" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "PARENT") {
    const children = (await createClient().from("profiles").select("id, name, grade").eq("parentId", user.id)).data ?? [];
    const month = await impactFor(scope, startOf("month"));
    return (
      <>
        <nav className="stagger card overflow-hidden">
          <Link href="/child" className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-panel">
            <IconCircle><Leaf size={22} /></IconCircle>
            <span className="flex-1">
              <span className="block text-sm font-medium">Child Progress</span>
              <span className="text-xs text-white/60">{children.length ? children.map((c) => `${c.name} • ${c.grade}`).join(", ") : "Link your child"}</span>
            </span>
            <ChevronRight size={16} className="text-white/50" />
          </Link>
          <MenuRow href="/stats" icon={<FileBarChart size={ICON} />} label="Child's Reports" />
          <MenuRow href="/notifications?t=ANNOUNCEMENT" icon={<Megaphone size={ICON} />} label="Teacher & School Announcements" />
          <MenuRow href="/events" icon={<CalendarDays size={ICON} />} label="Upcoming Activities" />
          <MenuRow href="/notifications" icon={<Bell size={ICON} />} label="Notifications" />
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
          <Stat icon={<Leaf size={24} className="text-leaf" />} value={`${user.points} pts`} label="Eco Creds" />
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
    const [{ count: students }, { data: grades }, all] = await Promise.all([
      admin().from("profiles").select("id", { count: "exact", head: true }).eq("schoolId", user.schoolId ?? "").eq("role", "STUDENT"),
      admin().from("profiles").select("grade").eq("schoolId", user.schoolId ?? "").eq("role", "STUDENT"),
      impactFor(scope),
    ]);
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={students ?? 0} label="Students" /><Stat value={new Set((grades ?? []).map((g) => g.grade)).size} label="Classes" /><Stat value={`${all.kg} kg`} label="Waste Recycled" /></div>
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
      impactFor("community", startOf("month")),
    ]);
    const pct = Math.min(100, Math.round((community.kg / COMMUNITY_GOAL_KG) * 100));
    return (
      <>
        <div className="grid grid-cols-2 gap-3"><Stat value={user.points} label="Points" /><Stat value={all.scans.length} label="Activities" /></div>
        <section className="card p-4">
          <h3 className="text-sm font-medium">Community Progress</h3>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-semibold">{pct}%</p>
            <div className="h-2 flex-1 rounded-full bg-panel"><div className="grow-x h-2 rounded-full bg-leaf" style={{ width: `${pct}%` }} /></div>
          </div>
          <p className="mt-1 text-xs text-white/50">{community.kg} of {COMMUNITY_GOAL_KG} kg monthly community goal</p>
        </section>
        <Menu items={[
          { href: "/community", icon: <UsersRound size={ICON} />, label: "My Community" },
          { href: "/events", icon: <CalendarDays size={ICON} />, label: "Local Campaigns & Events" },
          { href: "/partners", icon: <MapPin size={ICON} />, label: "Nearby Recycling Centres" },
          { href: "/marketplace/mine", icon: <Store size={ICON} />, label: "Marketplace Activity & Donations" },
          { href: "/rewards", icon: <Trophy size={ICON} />, label: "My Challenges" },
          { href: "/history", icon: <Activity size={ICON} />, label: "My Activities" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "COMMUNITY_ADMIN") {
    const [{ count: members }, month] = await Promise.all([
      admin().from("profiles").select("id", { count: "exact", head: true }).eq("communityId", user.communityId ?? ""),
      impactFor("community", startOf("month")),
    ]);
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={members ?? 0} label="Members" /><Stat value={`${month.kg} kg`} label="Collected this month" /><Stat value={`${month.recyclingRate}%`} label="Recycling rate" /></div>
        <Menu items={[
          { href: "/community", icon: <UsersRound size={ICON} />, label: "Manage Community & Members" },
          { href: "/events", icon: <CalendarDays size={ICON} />, label: "Create Campaigns & Events" },
          { href: "/community#points", icon: <MapPin size={ICON} />, label: "Collection Points" },
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Community Reports" },
          { href: "/community#announce", icon: <Megaphone size={ICON} />, label: "Send Announcements" },
          settings,
        ]} />
      </>
    );
  }

  if (user.role === "SUPER_ADMIN") {
    const [{ count: users }, { count: schools }, all] = await Promise.all([admin().from("profiles").select("id", { count: "exact", head: true }), admin().from("schools").select("id", { count: "exact", head: true }), impactFor("platform")]);
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={users ?? 0} label="Users" /><Stat value={schools ?? 0} label="Schools" /><Stat value={`${all.kg} kg`} label="Waste Reduced" /></div>
        <Menu items={[
          { href: "/admin/users", icon: <Users size={ICON} />, label: "Manage Users" },
          { href: "/admin/marketplace", icon: <Store size={ICON} />, label: "Marketplace Moderation" },
          { href: "/admin/schools", icon: <School size={ICON} />, label: "Schools" },
          { href: "/admin/communities", icon: <UsersRound size={ICON} />, label: "Communities" },
          { href: "/admin/challenges", icon: <Trophy size={ICON} />, label: "Challenges" },
          { href: "/admin/rewards", icon: <Award size={ICON} />, label: "Rewards & Points" },
          { href: "/stats", icon: <FileBarChart size={ICON} />, label: "Platform Analytics" },
          { href: "/admin/system", icon: <Settings size={ICON} />, label: "System Settings" },
          { href: "/admin/audit", icon: <ScrollText size={ICON} />, label: "Audit Logs" },
          { href: "/settings", icon: <SlidersHorizontal size={ICON} />, label: "My Account" },
        ]} />
      </>
    );
  }

  // Teacher / Health Monitor
  const [{ count: students }, all] = await Promise.all([admin().from("profiles").select("id", { count: "exact", head: true }).eq("schoolId", user.schoolId ?? "").eq("grade", user.grade ?? "").eq("role", "STUDENT"), impactFor(scope)]);
  return (
    <>
      <div className="grid grid-cols-3 gap-3"><Stat value={user.grade ?? "—"} label="Class" /><Stat value={students ?? 0} label="Students" /><Stat value={`${all.kg} kg`} label="Class Waste" /></div>
      <Menu items={user.role === "TEACHER" ? [
        { href: "/teacher", icon: <Building2 size={ICON} />, label: "Manage My Class & Tasks" },
        { href: "/teacher#challenge", icon: <Trophy size={ICON} />, label: "Create Class Challenge" },
        { href: "/teacher#announce", icon: <Megaphone size={ICON} />, label: "Send Class Announcement" },
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
