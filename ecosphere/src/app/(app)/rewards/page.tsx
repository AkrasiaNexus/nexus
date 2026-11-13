import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BADGES, earnedBadges } from "@/lib/rewards";
import { GUIDE, round } from "@/lib/waste";
import { Header } from "@/components/ui";
import { claimChallenge, joinChallenge, setAvatar } from "../../actions";

const AVATARS = ["🌱", "🧑‍🎓", "👩‍🎓", "🧑‍💼", "👪", "🌍", "🦊", "🐢", "🌻", "🏫"];

export default async function Rewards() {
  const user = await requireUser();
  const [scans, types, purchases, challenges] = await Promise.all([
    db.scan.count({ where: { userId: user.id } }),
    db.scan.groupBy({ by: ["wasteType"], where: { userId: user.id } }),
    db.purchase.count({ where: { userId: user.id } }),
    db.challenge.findMany({ where: { endsAt: { gte: new Date() } }, include: { joins: { where: { userId: user.id } } }, orderBy: { endsAt: "asc" } }),
  ]);
  const progress = await Promise.all(challenges.map(async (c) => {
    const join = c.joins[0];
    if (!join) return 0;
    const s = await db.scan.aggregate({ where: { userId: user.id, wasteType: c.wasteType, createdAt: { gte: join.joinedAt } }, _sum: { weightKg: true } });
    return s._sum.weightKg ?? 0;
  }));
  const earned = new Set(earnedBadges({ scans, points: user.points, types: types.length, purchases, challenges: challenges.filter((c) => c.joins[0]?.completed).length }).map((b) => b.id));

  return (
    <>
      <Header title="Green Points & Rewards" />
      <div className="flex flex-col gap-5 px-5">
        <section className="flex flex-col items-center gap-3">
          <div className="grid h-36 w-36 place-items-center rounded-full border-4 border-leaf bg-card text-center">
            <div><span className="text-2xl">🌿</span><p className="text-3xl font-bold">{user.points}</p><p className="text-xs text-mute">Points</p></div>
          </div>
          <Link href="/marketplace" className="btn w-full">Redeem Rewards</Link>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Your Badges</h2>
          <ul className="grid grid-cols-4 gap-3">
            {BADGES.map((b) => (
              <li key={b.id} className={`card flex flex-col items-center gap-1 p-2 text-center ${earned.has(b.id) ? "" : "opacity-30 grayscale"}`}
                title={earned.has(b.id) ? "Earned" : "Locked"}>
                <span className="text-2xl">{b.emoji}</span><span className="text-[10px] leading-tight">{b.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Challenges</h2>
          {challenges.map((c, i) => {
            const join = c.joins[0];
            const pct = Math.min(100, Math.round((progress[i] / c.targetKg) * 100));
            return (
              <article key={c.id} className="card space-y-2 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{GUIDE[c.wasteType].emoji}</span>
                  <div className="flex-1">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-mute">{c.description}</p>
                  </div>
                  <span className="chip shrink-0">+{c.rewardPoints}</span>
                </div>
                {join ? (
                  <>
                    <div className="h-2 rounded bg-panel"><div className="h-2 rounded bg-leaf" style={{ width: `${pct}%` }} /></div>
                    <p className="text-xs text-mute">{round(progress[i])} / {c.targetKg} kg</p>
                    {join.completed ? <p className="text-sm text-leaf">✓ Completed</p>
                      : pct >= 100 && <form action={claimChallenge.bind(null, c.id)}><button className="btn w-full py-2 text-sm">Claim {c.rewardPoints} pts</button></form>}
                  </>
                ) : (
                  <form action={joinChallenge.bind(null, c.id)}><button className="btn-ghost w-full py-2 text-sm">Join challenge</button></form>
                )}
              </article>
            );
          })}
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Customise Your Profile</h2>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <form key={a} action={setAvatar.bind(null, a)}>
                <button aria-label={`Use avatar ${a}`} className={`grid h-12 w-12 place-items-center rounded-full bg-card text-2xl ${a === user.avatar ? "ring-2 ring-leaf" : ""}`}>{a}</button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
