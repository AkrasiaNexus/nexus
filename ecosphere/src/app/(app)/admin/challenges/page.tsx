import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { withDates } from "@/lib/queries";
import { GUIDE, WASTE_TYPES } from "@/lib/waste";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { createChallenge, endChallenge } from "../../../admin-actions";

export default async function AdminChallenges() {
  await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const [{ data: rows }, { data: joins }, { data: schools }] = await Promise.all([
    db.from("challenges").select("id, title, wasteType, targetKg, rewardPoints, endsAt, schoolId, className").order("endsAt", { ascending: false }).limit(60),
    db.from("challenge_joins").select("challengeId, completed"),
    db.from("schools").select("id, name"),
  ]);
  const school = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const now = new Date();
  const list = withDates(rows, "endsAt");
  const stat = (id: string) => { const j = (joins ?? []).filter((x) => x.challengeId === id); return `${j.length} joined · ${j.filter((x) => x.completed).length} done`; };
  return (
    <>
      <Header title="Challenges" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <ActionForm action={createChallenge} submit="Publish to everyone">
          <h2 className="font-semibold">New platform challenge</h2>
          <input name="title" required maxLength={80} placeholder="Title" aria-label="Title" className="input" />
          <textarea name="description" required maxLength={280} rows={2} placeholder="What should people do?" aria-label="Description" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <select name="wasteType" aria-label="Waste type" className="input">{WASTE_TYPES.map((t) => <option key={t} value={t}>{GUIDE[t].name}</option>)}</select>
            <input name="targetKg" type="number" step="0.1" min="0.1" max="100" required placeholder="Target kg" aria-label="Target kg" className="input" />
            <input name="rewardPoints" type="number" min="0" max="200" required placeholder="Reward EC" aria-label="Reward points" className="input" />
            <input name="endsAt" type="date" required aria-label="End date" className="input" />
          </div>
        </ActionForm>
        <ul className="stagger-slow card overflow-hidden">
          {list.map((c) => {
            const live = c.endsAt > now;
            return (
              <li key={c.id} className="flex items-center gap-3 border-b border-line p-4 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-mute">
                    {c.schoolId ? `${c.className} · ${school.get(c.schoolId) ?? "school"}` : "Platform-wide"} · {GUIDE[c.wasteType as keyof typeof GUIDE].name} {c.targetKg} kg · +{c.rewardPoints} EC · {stat(c.id)}
                  </p>
                  <p className={`text-xs ${live ? "text-leaf" : "text-mute"}`}>{live ? `Ends ${c.endsAt.toLocaleDateString()}` : `Ended ${c.endsAt.toLocaleDateString()}`}</p>
                </div>
                {live && <form action={endChallenge.bind(null, c.id)}><button className="chip text-xs">End now</button></form>}
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-mute">No challenges yet.</li>}
        </ul>
      </div>
    </>
  );
}
