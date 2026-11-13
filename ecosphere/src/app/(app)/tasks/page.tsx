import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { markTaskDone } from "../../feature-actions";

export default async function Tasks() {
  const s = await requireUser(["STUDENT"]);
  const tasks = await db.task.findMany({
    where: { schoolId: s.schoolId ?? "", className: s.grade ?? "" }, orderBy: { dueAt: "asc" },
    include: { dones: { where: { userId: s.id } }, creator: { select: { name: true } } },
  });
  return (
    <>
      <Header title="Class Tasks" />
      <div className="flex flex-col gap-3 px-5">
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
