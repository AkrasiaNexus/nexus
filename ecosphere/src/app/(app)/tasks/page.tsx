import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicNames, withDates } from "@/lib/queries";
import { Header } from "@/components/ui";
import { markTaskDone } from "../../feature-actions";

export default async function Tasks() {
  const s = await requireUser(["STUDENT"]);
  const sb = createClient();
  const [{ data: rows }, { data: dones }] = await Promise.all([
    sb.from("tasks").select("*").eq("schoolId", s.schoolId ?? "").eq("className", s.grade ?? "").order("dueAt"),
    sb.from("task_dones").select("*").eq("userId", s.id),
  ]);
  const creators = await publicNames((rows ?? []).map((t) => t.creatorId));
  const tasks = withDates(rows, "dueAt").map((t) => ({
    ...t, dones: (dones ?? []).filter((d) => d.taskId === t.id), creator: creators.get(t.creatorId) ?? { name: "Your teacher" },
  }));
  return (
    <>
      <Header title="Class Tasks" />
      <div className="stagger flex flex-col gap-3 px-5">
        {tasks.map((t) => {
          const d = t.dones[0];
          return (
            <article key={t.id} className="card space-y-2 p-4">
              <div className="flex justify-between gap-2"><p className="font-medium">{t.title}</p><span className="chip shrink-0">+{t.points}</span></div>
              <p className="text-sm text-mute">{t.description}</p>
              <p className="text-xs text-mute">From {t.creator.name} · due {t.dueAt.toLocaleDateString()}</p>
              {d ? <p className="text-sm text-leaf">{d.approved ? "✓ Approved, points added" : "⏳ Waiting for teacher approval"}</p>
                : <form action={markTaskDone.bind(null, t.id)}><button className="btn w-full py-2 text-sm">Mark as done</button></form>}
            </article>
          );
        })}
        {tasks.length === 0 && <p className="card p-6 text-center text-sm text-mute">No tasks from your teacher yet.</p>}
      </div>
    </>
  );
}
