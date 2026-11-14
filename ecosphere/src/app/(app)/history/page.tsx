import Link from "next/link";
import { Award, ClipboardCheck, Leaf, ShoppingBag, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncBadges } from "@/lib/queries";
import { BADGES } from "@/lib/rewards";
import { Header, IconCircle, timeAgo, type Tone } from "@/components/ui";

const TABS = ["All", "Scan", "Rewards", "Marketplace"] as const;
type Row = { id: string; at: Date; icon: React.ReactNode; tone: Tone; title: string; sub?: string; pts?: string; good?: boolean };

export default async function History({ searchParams }: { searchParams: { t?: string; msg?: string } }) {
  const user = await requireUser();
  const tab = TABS.find((t) => t === searchParams.t) ?? "All";
  const want = (t: (typeof TABS)[number]) => tab === "All" || tab === t;
  await syncBadges(user.id);
  const [scans, purchases, challenges, badges, tasks] = await Promise.all([
    want("Scan") ? db.scan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    want("Marketplace") ? db.purchase.findMany({ where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    want("Rewards") ? db.challengeJoin.findMany({ where: { userId: user.id, completed: true }, include: { challenge: true } }) : [],
    want("Rewards") ? db.userBadge.findMany({ where: { userId: user.id } }) : [],
    want("Rewards") ? db.taskDone.findMany({ where: { userId: user.id, approved: true }, include: { task: true } }) : [],
  ]);
  const rows: Row[] = [
    ...scans.map((s) => ({ id: s.id, at: s.createdAt, icon: <Leaf size={22} />, tone: "green" as Tone, title: `Scanned: ${s.label}`, pts: `+${s.points} pts`, good: true })),
    ...purchases.map((p) => ({ id: p.id, at: p.createdAt, icon: <ShoppingBag size={22} />, tone: "orange" as Tone, title: `${p.listing.ownerId ? "Claimed" : "Purchased"}: ${p.listing.title}`, pts: p.points ? `-${p.points} pts` : "Free" })),
    ...challenges.map((c) => ({ id: c.challengeId, at: c.completedAt ?? c.joinedAt, icon: <Trophy size={22} />, tone: "gold" as Tone, title: "Completed Challenge", sub: c.challenge.title, pts: `+${c.challenge.rewardPoints} pts`, good: true })),
    ...badges.map((b) => ({ id: b.badgeId, at: b.earnedAt, icon: <Award size={22} />, tone: "gold" as Tone, title: "Earned Badge", sub: BADGES.find((x) => x.id === b.badgeId)?.name })),
    ...tasks.map((t) => ({ id: t.taskId, at: t.doneAt, icon: <ClipboardCheck size={22} />, tone: "teal" as Tone, title: "Task approved", sub: t.task.title, pts: `+${t.task.points} pts`, good: true })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <Header title="Activity History" back="/profile" />
      <div className="flex flex-col gap-3 px-5">
        {searchParams.msg && <p role="status" className="card p-3 text-center text-sm text-leaf">{searchParams.msg.slice(0, 100)}</p>}
        <nav className="flex justify-between gap-2">
          {TABS.map((t) => <Link key={t} href={`/history?t=${t}`} className={`chip ${t === tab ? "chip-on" : ""}`}>{t}</Link>)}
        </nav>
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.title + r.id} className="flex items-center gap-4 border-b border-white/[.05] py-3.5 last:border-0">
              <IconCircle tone={r.tone} size={46}>{r.icon}</IconCircle>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm capitalize">{r.title}</p>
                {r.sub && <p className="truncate text-sm text-white/70">{r.sub}</p>}
                {r.pts && <p className={`text-sm ${r.good ? "text-leaf" : "text-orange-300"}`}>{r.pts}</p>}
              </div>
              <span className="shrink-0 self-start text-[11px] text-white/50">{timeAgo(r.at)}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="card p-6 text-center text-sm text-white/55">No activity yet. Go scan something!</li>}
        </ul>
      </div>
    </>
  );
}
