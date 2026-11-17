import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withDates } from "@/lib/queries";
import type { HealthRow } from "@/components/HealthStatus";
import { impactFor, scanScope, startOf } from "@/lib/queries";
import { impact } from "@/lib/waste";
import { ActionForm } from "@/components/ActionForm";
import { HealthStatus } from "@/components/HealthStatus";
import { Header, Stat } from "@/components/ui";
import { announceToClass, approveTask, createClassChallenge, createEvent, createTask } from "../../feature-actions";
import { GUIDE, WASTE_TYPES } from "@/lib/waste";

export default async function TeacherDashboard() {
  const t = await requireUser(["TEACHER"]);
  const since = startOf("month");
  const sb = createClient();
  const [classImpact, studentRes, taskRes, healthRes] = await Promise.all([
    impactFor(scanScope(t), since),
    sb.from("profiles").select("*, scans(wasteType, weightKg, createdAt), taskDones:task_dones(*)").eq("schoolId", t.schoolId ?? "").eq("grade", t.grade ?? "").eq("role", "STUDENT").order("points", { ascending: false }),
    sb.from("tasks").select("*, dones:task_dones(*, user:profiles(name))").eq("creatorId", t.id).order("dueAt", { ascending: false }),
    sb.from("health_reports").select("*").eq("schoolId", t.schoolId ?? "").eq("className", t.grade ?? "").order("createdAt", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const students = (studentRes.data ?? []).map((s) => ({ ...s, scans: (s.scans ?? []).filter((x: { createdAt: string }) => new Date(x.createdAt) >= since) }));
  const tasks = withDates(taskRes.data, "dueAt");
  const health = healthRes.data ? ({ ...healthRes.data, createdAt: new Date(healthRes.data.createdAt) } as HealthRow) : null;
  const active = students.filter((s) => s.scans.length > 0).length;

  return (
    <>
      <Header title={t.grade ?? "My Class"} back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
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
                <tr key={s.id} className="border-t border-line text-center"><td className="py-2 text-left">{s.avatar} {s.name}</td><td>{s.scans.length}</td><td>{i.kg}</td><td>{i.recyclingRate}%</td><td>{s.taskDones.filter((d: { approved: boolean }) => d.approved).length}</td><td>{s.points}</td></tr>
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
              {task.dones.filter((d: { approved: boolean }) => !d.approved).map((d: { userId: string; user: { name: string } }) => (
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

        <ActionForm id="challenge" action={createClassChallenge} submit="Publish class challenge">
          <h3 className="text-sm font-medium">Create a class challenge</h3>
          <input name="title" required maxLength={80} placeholder="e.g. Class 10 Can Collection" aria-label="Challenge title" className="input" />
          <textarea name="description" required maxLength={280} rows={2} placeholder="What should students do?" aria-label="Challenge description" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <select name="wasteType" aria-label="Waste type" className="input">{WASTE_TYPES.map((t) => <option key={t} value={t}>{GUIDE[t].name}</option>)}</select>
            <input name="targetKg" type="number" step="0.1" min="0.1" max="100" defaultValue="1" aria-label="Target kg" className="input" />
            <input name="rewardPoints" type="number" min="0" max="200" defaultValue="50" aria-label="Reward points" className="input" />
            <input name="endsAt" type="date" required aria-label="End date" className="input" />
          </div>
        </ActionForm>

        <ActionForm id="announce" action={announceToClass} submit="Send to class & parents">
          <h3 className="text-sm font-medium">Class announcement</h3>
          <input name="title" required maxLength={80} placeholder="Title" aria-label="Announcement title" className="input" />
          <textarea name="body" required maxLength={280} rows={2} placeholder="Message" aria-label="Announcement message" className="input" />
        </ActionForm>

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
