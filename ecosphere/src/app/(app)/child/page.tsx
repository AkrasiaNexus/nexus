import { HeartPulse } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { healthAlerts } from "@/lib/health";
import { impactFor, startOf } from "@/lib/queries";
import { goalPercent } from "@/lib/rewards";
import { Header, timeAgo } from "@/components/ui";
import { LinkChildForm } from "../profile/LinkChildForm";

export default async function ChildProgress() {
  const parent = await requireUser(["PARENT"]);
  const children = await db.user.findMany({ where: { parentId: parent.id } });
  const [month, week, health, messages] = await Promise.all([
    Promise.all(children.map((c) => impactFor({ userId: c.id }, startOf("month")))),
    Promise.all(children.map((c) => impactFor({ userId: c.id }, startOf("week")))),
    Promise.all(children.map((c) => db.healthReport.findFirst({ where: { schoolId: c.schoolId ?? "", className: c.grade ?? "" }, orderBy: { createdAt: "desc" } }))),
    db.notification.findMany({ where: { userId: parent.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  return (
    <>
      <Header title="Child Progress" back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        {children.map((c, i) => (
          <section key={c.id} className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#cfd8d2] text-2xl">{c.avatar}</span>
              <div className="flex-1"><p className="font-medium">{c.name}</p><p className="text-xs text-white/60">{c.grade} · {c.points} pts</p></div>
            </div>
            <div className="h-2 rounded bg-panel"><div className="h-2 rounded bg-leaf" style={{ width: `${goalPercent(month[i].kg)}%` }} /></div>
            <p className="text-xs text-white/60">{month[i].kg} of 20 kg monthly green goal</p>
            <p className="text-sm text-white/75">
              <b className="text-white">This week:</b> {week[i].scans.length} items ({week[i].kg} kg), {week[i].recyclingRate}% recycled, {week[i].co2} kg CO₂ saved.
              {week[i].scans.length === 0 ? " Encourage them to scan a few items! 🌱" : week[i].recyclingRate >= 80 ? " Great sorting habits! 🌟" : " Room to improve sorting. 💪"}
            </p>
            <p className={`flex items-start gap-2 text-xs ${health[i] && healthAlerts(health[i]!).length ? "text-yellow-200" : "text-leaf"}`}>
              <HeartPulse size={14} className="mt-0.5 shrink-0" />
              {health[i] ? (healthAlerts(health[i]!).join(" · ") || "Classroom all clear") : "No classroom health report yet"}
            </p>
          </section>
        ))}
        <section className="card space-y-2 p-4">
          <h3 className="text-sm font-medium">{children.length ? "Link another child" : "Link your child"}</h3>
          <LinkChildForm />
        </section>
        <section className="card space-y-2 p-4">
          <h3 className="text-sm font-medium">Messages from school</h3>
          {messages.map((m) => <p key={m.id} className="text-xs"><b>{m.title}</b> <span className="text-white/55">· {m.body} · {timeAgo(m.createdAt)}</span></p>)}
          {messages.length === 0 && <p className="text-xs text-white/55">No messages yet.</p>}
        </section>
      </div>
    </>
  );
}
