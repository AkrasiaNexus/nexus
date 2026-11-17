import Link from "next/link";
import { claimChallenge, joinChallenge } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import type { WasteType } from "@/lib/types";
import { GUIDE, round } from "@/lib/waste";

// Active challenges with join / progress / claim. Used by /challenges (all) and /rewards (preview).
export async function ChallengeList({ userId, limit }: { userId: string; limit?: number }) {
  const sb = createClient();
  const [{ data: rows }, { data: joins }, { data: myScans }] = await Promise.all([
    sb.from("challenges").select("*").gte("endsAt", new Date().toISOString()).order("endsAt"),
    sb.from("challenge_joins").select("*").eq("userId", userId),
    sb.from("scans").select("wasteType, weightKg, createdAt").eq("userId", userId),
  ]);
  const all = (rows ?? []).map((c) => ({ ...c, wasteType: c.wasteType as WasteType, endsAt: new Date(c.endsAt), join: (joins ?? []).find((j) => j.challengeId === c.id) }));
  const challenges = limit ? all.slice(0, limit) : all;
  // Progress = kg of the challenge's waste type logged since joining (the claim RPC re-checks this in SQL).
  const progress = challenges.map((c) => c.join ? (myScans ?? []).filter((x) => x.wasteType === c.wasteType && x.createdAt >= c.join.joinedAt).reduce((t, x) => t + x.weightKg, 0) : 0);

  return (
    <div className="stagger flex flex-col gap-3">
      {challenges.map((c, i) => {
        const pct = Math.min(100, Math.round((progress[i] / c.targetKg) * 100));
        return (
          <article key={c.id} className="card space-y-2 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{GUIDE[c.wasteType as WasteType].emoji}</span>
              <div className="flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-white/60">{c.description}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{c.className ? `Class challenge · ${c.className}` : "Platform challenge"} · ends {c.endsAt.toLocaleDateString()}</p>
              </div>
              <span className="chip shrink-0">+{c.rewardPoints}</span>
            </div>
            {c.join ? (
              <>
                <div className="h-2 rounded bg-panel"><div className="grow-x h-2 rounded bg-leaf" style={{ width: `${pct}%` }} /></div>
                <p className="text-xs text-white/60">{round(progress[i])} / {c.targetKg} kg</p>
                {c.join.completed ? <p className="text-sm text-leaf">✓ Completed</p>
                  : pct >= 100 && <form action={claimChallenge.bind(null, c.id)}><button className="btn w-full py-2 text-sm">Claim {c.rewardPoints} EC</button></form>}
              </>
            ) : (
              <form action={joinChallenge.bind(null, c.id)}><button className="btn-ghost w-full py-2 text-sm">Join challenge</button></form>
            )}
          </article>
        );
      })}
      {challenges.length === 0 && <p className="card p-6 text-center text-sm text-white/55">No active challenges right now. Check back soon.</p>}
      {limit && all.length > limit && <Link href="/challenges" className="text-center text-sm text-leaf">See all {all.length} challenges →</Link>}
    </div>
  );
}
