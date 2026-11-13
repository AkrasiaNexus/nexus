import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOf } from "@/lib/queries";
import { impact } from "@/lib/waste";
import { BroadcastForm } from "@/components/BroadcastForm";
import { ExportLinks } from "@/components/ExportLinks";
import { healthAlerts, healthStatus } from "@/lib/health";
import { Header } from "@/components/ui";

export default async function SchoolReports() {
  const admin = await requireUser(["SCHOOL_ADMIN"]);
  const students = await db.user.findMany({
    where: { schoolId: admin.schoolId, role: "STUDENT" },
    include: { scans: { where: { createdAt: { gte: startOf("month") } }, select: { wasteType: true, weightKg: true } } },
    orderBy: { points: "desc" },
  });
  const grades = Array.from(new Set(students.map((s) => s.grade ?? "Unassigned")));
  const classes = grades
    .map((grade) => students.filter((s) => (s.grade ?? "Unassigned") === grade))
    .map((list) => ({ grade: list[0].grade ?? "Unassigned", count: list.length, ...impact(list.flatMap((s) => s.scans)) }))
    .sort((a, b) => b.kg - a.kg);
  const max = Math.max(1, ...classes.map((c) => c.kg));
  const reports = await Promise.all(classes.map((c) => db.healthReport.findFirst({ where: { schoolId: admin.schoolId ?? "", className: c.grade }, orderBy: { createdAt: "desc" } })));
  const STATUS = { OK: "🟢", WATCH: "🟡", ACTION: "🔴" };

  return (
    <>
      <Header title={admin.school?.name ?? "School"} back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-medium">Class-wise waste sorted · this month</h2>
          {classes.map((c) => (
            <div key={c.grade} className="text-xs">
              <div className="flex justify-between"><span>{c.grade} <span className="text-mute">({c.count} students)</span></span><span>{c.kg} kg · {c.recyclingRate}% recycled</span></div>
              <div className="mt-1 h-2 rounded bg-panel"><div className="h-2 rounded bg-leaf" style={{ width: `${(c.kg / max) * 100}%` }} /></div>
            </div>
          ))}
          {classes.length === 0 && <p className="text-sm text-mute">No students yet.</p>}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-medium">Cleaning, bins & health by class</h2>
          <table className="w-full text-xs">
            <thead className="text-mute"><tr><th className="text-left">Class</th><th>Status</th><th>Cleaning</th><th>Bins</th><th>Attend.</th></tr></thead>
            <tbody>
              {classes.map((c, i) => { const r = reports[i]; return (
                <tr key={c.grade} className="border-t border-line text-center">
                  <td className="py-2 text-left">{c.grade}</td>
                  <td>{r ? STATUS[healthStatus(healthAlerts(r))] : "—"}</td>
                  <td>{r?.cleaning.replace("_", " ").toLowerCase() ?? "—"}</td>
                  <td>{r?.wasteLevel.toLowerCase() ?? "—"}</td>
                  <td>{r ? `${Math.round((r.present / r.total) * 100)}%` : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
          <a href="/health" className="mt-2 inline-block text-xs text-leaf">File a report / see incidents →</a>
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-medium">Top students</h2>
          <ol className="space-y-1 text-sm">
            {students.slice(0, 8).map((s, i) => <li key={s.id} className="flex gap-2"><span className="w-5 text-mute">{i + 1}</span><span className="flex-1">{s.avatar} {s.name} <span className="text-mute">· {s.grade}</span></span><span>{s.points} pts</span></li>)}
          </ol>
        </section>
        <ExportLinks />
        <BroadcastForm audience="everyone at your school and their parents" />
      </div>
    </>
  );
}
