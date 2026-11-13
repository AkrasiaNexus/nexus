import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GUIDE } from "@/lib/waste";
import { Header, timeAgo } from "@/components/ui";

const TABS = ["All", "Scans", "Rewards"] as const;

export default async function History({ searchParams }: { searchParams: { t?: string; msg?: string } }) {
  const user = await requireUser();
  const tab = TABS.find((t) => t === searchParams.t) ?? "All";
  const [scans, purchases] = await Promise.all([
    tab !== "Rewards" ? db.scan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    tab !== "Scans" ? db.purchase.findMany({ where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
  ]);
  const rows = [
    ...scans.map((s) => ({ id: s.id, at: s.createdAt, icon: GUIDE[s.wasteType].emoji, title: `Scanned: ${s.label}`, sub: `${GUIDE[s.wasteType].name} · ${s.weightKg} kg`, pts: `+${s.points} pts`, good: true })),
    ...purchases.map((p) => ({ id: p.id, at: p.createdAt, icon: p.listing.emoji, title: `${p.listing.ownerId ? "Claimed" : "Redeemed"}: ${p.listing.title}`, sub: p.listing.category, pts: `-${p.points} pts`, good: false })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <Header title="Activity History" back="/profile" />
      <div className="flex flex-col gap-3 px-5">
        {searchParams.msg && <p role="status" className="card p-3 text-center text-sm text-leaf">{searchParams.msg.slice(0, 100)}</p>}
        <nav className="flex gap-2">
          {TABS.map((t) => <Link key={t} href={`/history?t=${t}`} className={`chip ${t === tab ? "chip-on" : ""}`}>{t}</Link>)}
        </nav>
        <ul className="card overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-panel text-xl">{r.icon}</span>
              <div className="flex-1"><p className="text-sm capitalize">{r.title}</p><p className="text-xs text-mute">{r.sub}</p></div>
              <div className="text-right"><p className={`text-sm ${r.good ? "text-leaf" : "text-orange-300"}`}>{r.pts}</p><p className="text-[11px] text-mute">{timeAgo(r.at)}</p></div>
            </li>
          ))}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-mute">No activity yet. Go scan something!</li>}
        </ul>
      </div>
    </>
  );
}
