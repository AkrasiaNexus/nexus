import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactFor, scanScope, startOf } from "@/lib/queries";
import { impact } from "@/lib/waste";
import { ActionForm } from "@/components/ActionForm";
import { HealthStatus } from "@/components/HealthStatus";
import { Header, Stat } from "@/components/ui";
import { approveTask, createEvent, createTask } from "../../feature-actions";

export default async function TeacherDashboard() {
  const t = await requireUser(["TEACHER"]);
  const since = startOf("month");
  const [classImpact, students, tasks, health] = await Promise.all([
    impactFor(scanScope(t), since),
    db.user.findMany({
      where: { schoolId: t.schoolId, grade: t.grade, role: "STUDENT" }, orderBy: { points: "desc" },
      include: { scans: { where: { createdAt: { gte: since } }, select: { wasteType: true, weightKg: true } }, taskDones: true },
    }),
    db.task.findMany({ where: { creatorId: t.id }, orderBy: { dueAt: "desc" }, include: { dones: { include: { user: { select: { name: true } } } } } }),
    db.healthReport.findFirst({ where: { schoolId: t.schoolId ?? "", className: t.grade ?? "" }, orderBy: { createdAt: "desc" } }),
  ]);
  const active = students.filter((s) => s.scans.length > 0).length;

  return (
    <>
      <Header title={t.grade ?? "My Class"} back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={students.length} label="Students" />
          <Stat value={`${classImpact.kg} kg`} label="Sorted this month" />
          <Stat value={`${students.length ? Math.round((active / students.length) * 100) : 0}%`} label="Participation" />
        </div>

        <section className="card p-4"><h2 className="mb-2 text-sm font-medium">Classroom health & safety</h2><HealthStatus report={health} /></section>

        <section className="card overflow-x-auto p-4">
          <h2 className="mb-2 text-sm font-medium">Student performance · this month</h2>
          <table className="w-full text-xs">
            <thead className="text-mute"><tr><th className="text-left">Student</th><th>Items</th><th>kg</th><th>Recycled</th><th>Tasks</th><th>Pts</th></tr></thead>
            <tbody>
              {students.map((s) => { const i = impact(s.scans); return (
                <tr key={s.id} className="border-t border-line text-center"><td className="py-2 text-left">{s.avatar} {s.name}</td><td>{s.scans.length}</td><td>{i.kg}</td><td>{i.recyclingRate}%</td><td>{s.taskDones.filter((d) => d.approved).length}</td><td>{s.points}</td></tr>
              ); })}
            </tbody>
          </table>
          <a href="/api/export?type=scans" className="mt-3 inline-flex items-center gap-1 text-xs text-leaf"><Download size={14} />Export class data (CSV)</a>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Tasks</h2>
          {tasks.map((task) => (
            <article key={task.id} className="card space-y-2 p-4 text-sm">
              <p className="font-medium">{task.title} <span className="text-xs text-mute">· due {task.dueAt.toLocaleDateString()} · +{task.points} pts</span></p>
              <p className="text-xs text-mute">{task.dones.length}/{students.length} done</p>
              {task.dones.filter((d) => !d.approved).map((d) => (
                <form key={d.userId} action={approveTask.bind(null, task.id, d.userId)} className="flex items-center justify-between">
                  <span className="text-xs">{d.user.name} marked done</span><button className="chip chip-on">Approve</button>
                </form>
              ))}
            </article>
          ))}
          <ActionForm action={createTask} submit="Assign to class">
            <h3 className="text-sm font-medium">Assign a task</h3>
            <input name="title" required maxLength={80} placeholder="e.g. Bring 3 clean plastic bottles" aria-label="Task title" className="input" />
            <textarea name="description" required maxLength={280} rows={2} placeholder="Details" aria-label="Task details" className="input" />
            <div className="flex gap-2">
              <input name="points" type="number" min="0" max="200" defaultValue="20" aria-label="Points" className="input" />
              <input name="dueAt" type="date" required aria-label="Due date" className="input" />
            </div>
          </ActionForm>
        </section>

        <ActionForm action={createEvent} submit="Publish event">
          <h3 className="text-sm font-medium">Organise an event or workshop</h3>
          <select name="kind" aria-label="Type" className="input"><option value="EVENT">Event</option><option value="WORKSHOP">DIY / upcycling workshop</option><option value="CAMPAIGN">Campaign</option><option value="PROGRAM">Recycling program</option></select>
          <input name="title" required maxLength={80} placeholder="Title" aria-label="Event title" className="input" />
          <textarea name="description" required maxLength={280} rows={2} placeholder="Description" aria-label="Event description" className="input" />
          <input name="location" required maxLength={80} placeholder="Location" aria-label="Location" className="input" />
          <input name="startsAt" type="datetime-local" required aria-label="Start time" className="input" />
        </ActionForm>
      </div>
    </>
  );
}
