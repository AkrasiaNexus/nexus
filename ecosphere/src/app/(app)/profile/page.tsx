import { Activity, Award, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, ClipboardList, Download, FileBarChart, HeartPulse, Lock, MapPin, School, ScrollText, ShieldCheck, Users, Utensils } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailySeries, impactFor, scanScope, startOf } from "@/lib/queries";
import { goalPercent } from "@/lib/rewards";
import { healthAlerts } from "@/lib/health";
import { Bars, Header, MenuRow, Stat, timeAgo } from "@/components/ui";
import { logout } from "../../actions";
import { LinkChildForm } from "./LinkChildForm";

const ROLE_NAME: Record<Role, string> = {
  STUDENT: "Student", PARENT: "Parent", EMPLOYEE: "Employee", SCHOOL_ADMIN: "School Administrator", COMMUNITY: "Community Member", SUPER_ADMIN: "Super Administrator", TEACHER: "Teacher", HEALTH_MONITOR: "Health Monitor",
};
const CENTRES = ["Municipal Recycling Centre", "E-waste Collection Point", "Clothing & Textile Bank", "Community Compost Hub"];

export default async function Profile() {
  const user = await requireUser();
  const scope = scanScope(user);
  const [week, all] = await Promise.all([impactFor(scope, startOf("week")), impactFor(scope)]);
  const subtitle = [ROLE_NAME[user.role], user.grade, user.school?.name, user.department, user.community].filter(Boolean).join(" · ");

  return (
    <>
      <Header title={`${ROLE_NAME[user.role].replace("Administrator", "Admin")} Profile`} back={null} />
      <div className="flex flex-col gap-4 px-5">
        <section className="flex flex-col items-center gap-1 text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full border-2 border-leaf bg-card text-5xl">{user.avatar}</span>
          <h2 className="mt-2 text-xl font-semibold">{user.name}</h2>
          <p className="text-sm text-mute">{subtitle}</p>
          <p className="chip mt-1 font-mono">ID {user.memberId}</p>
        </section>
        <RoleBody userId={user.id} role={user.role} schoolId={user.schoolId} points={user.points} kg={all.kg} items={all.scans.length} department={user.department} grade={user.grade} />
        {["STUDENT", "EMPLOYEE", "COMMUNITY", "PARENT", "TEACHER", "HEALTH_MONITOR"].includes(user.role) && (
          <section className="card p-4">
            <h3 className="mb-3 text-sm font-medium">{user.role === "PARENT" ? "Children's" : ["TEACHER", "HEALTH_MONITOR"].includes(user.role) ? "Class" : "Your"} progress this week (kg)</h3>
            <Bars data={dailySeries(week.scans)} />
          </section>
        )}
        {user.role === "COMMUNITY" && (
          <section className="card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><MapPin size={16} className="text-leaf" />Nearby recycling centres</h3>
            <ul className="space-y-2 text-sm">
              {CENTRES.map((c) => (
                <li key={c}><a className="text-leaf underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/maps/search/${encodeURIComponent(c + " near me")}`}>{c} ↗</a></li>
              ))}
            </ul>
          </section>
        )}
        <nav className="card overflow-hidden">
          {menuFor(user.role).map((m) => <MenuRow key={m.href + m.label} {...m} />)}
        </nav>
        <form action={logout}><button className="btn-ghost w-full">Log out</button></form>
      </div>
    </>
  );
}

async function RoleBody({ userId, role, schoolId, points, kg, items, department, grade }: { userId: string; role: Role; schoolId: string | null; points: number; kg: number; items: number; department: string | null; grade: string | null }) {
  if (role === "PARENT") {
    const children = await db.user.findMany({ where: { parentId: userId }, include: { school: true } });
    const [month, week, health, messages] = await Promise.all([
      Promise.all(children.map((c) => impactFor({ userId: c.id }, startOf("month")))),
      Promise.all(children.map((c) => impactFor({ userId: c.id }, startOf("week")))),
      Promise.all(children.map((c) => db.healthReport.findFirst({ where: { schoolId: c.schoolId ?? "", className: c.grade ?? "" }, orderBy: { createdAt: "desc" } }))),
      db.notification.findMany({ where: { userId, kind: { in: ["ANNOUNCEMENT", "HEALTH", "TASK", "EVENT", "PICKUP"] } }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);
    return (
      <>
      <section className="card space-y-2 p-4">
        <h3 className="text-sm font-medium">Weekly summary</h3>
        {children.map((c, i) => (
          <p key={c.id} className="text-sm text-mute">
            <b className="text-white">{c.name.split(" ")[0]}</b> sorted {week[i].scans.length} items ({week[i].kg} kg) this week, {week[i].recyclingRate}% recycled, saving {week[i].co2} kg CO₂.
            {week[i].scans.length === 0 ? " Encourage them to scan a few items! 🌱" : week[i].recyclingRate >= 80 ? " Great sorting habits! 🌟" : " Room to improve sorting. 💪"}
          </p>
        ))}
      </section>
      <section className="card space-y-2 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium"><HeartPulse size={16} className="text-leaf" />Health & safety</h3>
        {children.map((c, i) => { const a = health[i] ? healthAlerts(health[i]!) : []; return (
          <p key={c.id} className={`text-xs ${a.length ? "text-yellow-200" : "text-leaf"}`}>{c.grade}: {health[i] ? (a.length ? a.join(" · ") : "All clear") : "No report yet"}</p>
        ); })}
      </section>
      <section className="card space-y-2 p-4">
        <h3 className="text-sm font-medium">Messages from school</h3>
        {messages.map((m) => <p key={m.id} className="text-xs"><b>{m.title}</b> <span className="text-mute">· {m.body} · {timeAgo(m.createdAt)}</span></p>)}
        {messages.length === 0 && <p className="text-xs text-mute">No messages yet.</p>}
      </section>
      <section className="card space-y-3 p-4">
        <h3 className="text-sm font-medium">Child Progress</h3>
        {children.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3">
            <span className="text-2xl">{c.avatar}</span>
            <div className="flex-1">
              <p className="text-sm">{c.name} <span className="text-mute">· {c.grade}</span></p>
              <div className="mt-1 h-2 rounded bg-panel"><div className="h-2 rounded bg-leaf" style={{ width: `${goalPercent(month[i].kg)}%` }} /></div>
            </div>
            <span className="text-xs text-mute">{c.points} pts</span>
          </div>
        ))}
        {children.length === 0 && <p className="text-sm text-mute">No child linked yet.</p>}
        <LinkChildForm />
      </section>
      </>
    );
  }
  if (role === "SCHOOL_ADMIN") {
    const [students, classes] = await Promise.all([
      db.user.count({ where: { schoolId, role: "STUDENT" } }),
      db.user.groupBy({ by: ["grade"], where: { schoolId, role: "STUDENT" } }),
    ]);
    return <div className="grid grid-cols-3 gap-3"><Stat value={students} label="Students" /><Stat value={classes.length} label="Classes" /><Stat value={`${kg} kg`} label="Waste Recycled" /></div>;
  }
  if (role === "SUPER_ADMIN") {
    const [users, schools] = await Promise.all([db.user.count(), db.school.count()]);
    return <div className="grid grid-cols-3 gap-3"><Stat value={users} label="Users" /><Stat value={schools} label="Schools" /><Stat value={`${kg} kg`} label="Waste Reduced" /></div>;
  }
  if (role === "TEACHER" || role === "HEALTH_MONITOR") {
    const students = await db.user.count({ where: { schoolId, grade, role: "STUDENT" } });
    return <div className="grid grid-cols-3 gap-3"><Stat value={grade ?? "—"} label="Class" /><Stat value={students} label="Students" /><Stat value={`${kg} kg`} label="Class waste sorted" /></div>;
  }
  if (role === "EMPLOYEE" && department) {
    const colleagues = await db.user.findMany({ where: { role: "EMPLOYEE", department }, orderBy: { points: "desc" }, select: { id: true, name: true, points: true } });
    const dept = await impactFor({ user: { role: "EMPLOYEE", department } }, startOf("month"));
    return (
      <>
        <div className="grid grid-cols-3 gap-3"><Stat value={points} label="Green Points" /><Stat value={`${kg} kg`} label="Waste Reduced" /><Stat value={`${dept.kg} kg`} label={`${department} this month`} /></div>
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-medium">My Department · {department}</h3>
          <ol className="space-y-1 text-sm">{colleagues.map((c, i) => <li key={c.id} className={`flex gap-2 ${c.id === userId ? "text-leaf" : ""}`}><span className="w-5 text-mute">{i + 1}</span><span className="flex-1">{c.name}</span><span>{c.points} pts</span></li>)}</ol>
        </section>
      </>
    );
  }
  const joined = await db.challengeJoin.count({ where: { userId } });
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat value={points} label="Green Points" />
      <Stat value={`${kg} kg`} label="Waste Reduced" />
      <Stat value={role === "COMMUNITY" ? items : joined} label={role === "COMMUNITY" ? "Activities" : "Challenges"} />
    </div>
  );
}

function menuFor(role: Role) {
  const common = [
    { href: "/notifications", icon: <Bell size={18} />, label: "Notifications" },
    { href: "/guide", icon: <BookOpen size={18} />, label: "Recycling Guide" },
    { href: "/food", icon: <Utensils size={18} />, label: "Food Waste" },
    { href: "/events", icon: <CalendarDays size={18} />, label: "Events & Campaigns" },
    { href: "/privacy", icon: <Lock size={18} />, label: "Privacy, AI & My Data" },
  ];
  const byRole: Record<Role, { href: string; icon: React.ReactNode; label: string }[]> = {
    STUDENT: [{ href: "/tasks", icon: <ClipboardCheck size={18} />, label: "Class Tasks" }, { href: "/health", icon: <HeartPulse size={18} />, label: "Classroom Health" }, { href: "/history", icon: <Activity size={18} />, label: "Activity History" }, { href: "/rewards", icon: <Award size={18} />, label: "Achievements & Customisation" }, { href: "/stats", icon: <FileBarChart size={18} />, label: "My Reports" }],
    PARENT: [{ href: "/stats", icon: <FileBarChart size={18} />, label: "Child's Reports" }, { href: "/health", icon: <HeartPulse size={18} />, label: "Health & Safety Alerts" }],
    TEACHER: [{ href: "/teacher", icon: <School size={18} />, label: "Class Dashboard & Tasks" }, { href: "/health", icon: <HeartPulse size={18} />, label: "Classroom Health & Safety" }, { href: "/stats", icon: <FileBarChart size={18} />, label: "Class Reports" }],
    HEALTH_MONITOR: [{ href: "/health", icon: <HeartPulse size={18} />, label: "Daily Health Report & Incidents" }, { href: "/stats", icon: <FileBarChart size={18} />, label: "Class Waste Levels" }],
    EMPLOYEE: [{ href: "/stats", icon: <Building2 size={18} />, label: "Reports" }, { href: "/history", icon: <ClipboardList size={18} />, label: "Waste Records" }, { href: "/rewards", icon: <Award size={18} />, label: "Rewards" }],
    SCHOOL_ADMIN: [{ href: "/school", icon: <School size={18} />, label: "School Reports & Classes" }, { href: "/health", icon: <HeartPulse size={18} />, label: "Health & Safety (all classes)" }, { href: "/school#broadcast", icon: <Users size={18} />, label: "Message Students & Staff" }],
    COMMUNITY: [{ href: "/history", icon: <Activity size={18} />, label: "My Activities" }, { href: "/notifications", icon: <CalendarDays size={18} />, label: "Community Events" }],
    SUPER_ADMIN: [{ href: "/admin/users", icon: <Users size={18} />, label: "Manage Users" }, { href: "/admin/export", icon: <Download size={18} />, label: "Export Data" }, { href: "/stats", icon: <FileBarChart size={18} />, label: "Platform Analytics" }, { href: "/admin/audit", icon: <ScrollText size={18} />, label: "Audit Logs" }, { href: "/admin/users#broadcast", icon: <ShieldCheck size={18} />, label: "Broadcast Announcement" }],
  };
  return [...byRole[role], ...common];
}
