import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncBadges } from "@/lib/queries";
import { BADGES } from "@/lib/rewards";
import { GUIDE, round } from "@/lib/waste";
import { LeafLogo } from "@/components/art";
import { Header, IconCircle, type Tone } from "@/components/ui";
import { claimChallenge, joinChallenge, setAvatar } from "../../actions";

const QUICK_AVATARS = ["🧑‍🎓", "👩‍🎓", "🦊"];

export default async function Rewards({ searchParams }: { searchParams: { all?: string } }) {
  const user = await requireUser();
  const showAll = searchParams.all === "1";
  const [earned, challenges] = await Promise.all([
    syncBadges(user.id),
    db.challenge.findMany({ where: { endsAt: { gte: new Date() } }, include: { joins: { where: { userId: user.id } } }, orderBy: { endsAt: "asc" } }),
  ]);
  const progress = await Promise.all(challenges.map(async (c) => {
    const join = c.joins[0];
    if (!join) return 0;
    const s = await db.scan.aggregate({ where: { userId: user.id, wasteType: c.wasteType, createdAt: { gte: join.joinedAt } }, _sum: { weightKg: true } });
    return s._sum.weightKg ?? 0;
  }));
  const badges = showAll ? BADGES : BADGES.filter((b) => earned.has(b.id)).concat(BADGES.filter((b) => !earned.has(b.id))).slice(0, 4);
  const avatars = Array.from(new Set([...QUICK_AVATARS, user.avatar]));

  return (
    <>
      <Header title="Green Points & Rewards" />
      <div className="flex flex-col gap-6 px-5">
        <section className="flex flex-col items-center gap-5 pt-6">
          <div className="relative grid h-40 w-40 place-items-center rounded-full border-2 border-leaf/50 bg-[radial-gradient(circle,#1f4a26,#0b1a0e)] shadow-[0_0_40px_rgba(134,214,126,.25)]">
            <span className="absolute -top-9"><LeafLogo size={70} /></span>
            <div className="pt-4 text-center"><p className="text-4xl font-bold">{user.points}</p><p className="text-sm text-white/70">Points</p></div>
          </div>
          <Link href="/marketplace" className="btn w-full py-3.5">Redeem Rewards</Link>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Badges</h2>
            <Link href={showAll ? "/rewards" : "/rewards?all=1"} className="flex items-center gap-1 text-sm text-leaf">{showAll ? "Show less" : "View All"} <ArrowRight size={14} /></Link>
          </div>
          <ul className={showAll ? "grid grid-cols-4 gap-4" : "flex justify-between"}>
            {badges.map((b) => (
              <li key={b.id} className={`flex flex-col items-center gap-1 ${earned.has(b.id) ? "" : "opacity-30 grayscale"}`} title={`${b.name}${earned.has(b.id) ? "" : " (locked)"}`}>
                <IconCircle tone={b.tone as Tone} size={64}><span className="text-3xl">{b.emoji}</span></IconCircle>
                {showAll && <span className="text-center text-[10px] leading-tight">{b.name}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Customise Your Profile</h2>
          <div className="flex justify-between">
            {avatars.slice(0, 3).map((a) => (
              <form key={a} action={setAvatar.bind(null, a)}>
                <button aria-label={`Use avatar ${a}`} className={`grid h-16 w-16 place-items-center rounded-2xl bg-card text-4xl ${a === user.avatar ? "ring-2 ring-leaf" : ""}`}>{a}</button>
              </form>
            ))}
            <Link href="/settings#avatar" aria-label="More avatars" className="grid h-16 w-16 place-items-center rounded-2xl bg-card text-leaf"><Plus size={28} /></Link>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Challenges</h2>
          {challenges.map((c, i) => {
            const join = c.joins[0];
            const pct = Math.min(100, Math.round((progress[i] / c.targetKg) * 100));
            return (
              <article key={c.id} className="card space-y-2 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{GUIDE[c.wasteType].emoji}</span>
                  <div className="flex-1"><p className="font-medium">{c.title}</p><p className="text-xs text-white/60">{c.description}</p></div>
                  <span className="chip shrink-0">+{c.rewardPoints}</span>
                </div>
                {join ? (
                  <>
                    <div className="h-2 rounded bg-panel"><div className="h-2 rounded bg-leaf" style={{ width: `${pct}%` }} /></div>
                    <p className="text-xs text-white/60">{round(progress[i])} / {c.targetKg} kg</p>
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
      </div>
    </>
  );
}
