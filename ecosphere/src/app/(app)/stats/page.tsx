import Link from "next/link";
import { Sparkles, TreePine } from "lucide-react";
import type { WasteType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailySeries, impactFor, scanScope, startOf } from "@/lib/queries";
import { GUIDE, round } from "@/lib/waste";
import { Bars, Header, Ring, Stat } from "@/components/ui";

const PERIODS = { week: "This Week", month: "This Month", year: "This Year" } as const;
type Period = keyof typeof PERIODS;

export default async function Stats({ searchParams }: { searchParams: { p?: string } }) {
  const user = await requireUser();
  const period: Period = searchParams.p && searchParams.p in PERIODS ? (searchParams.p as Period) : "week";
  const scope = scanScope(user);
  const [data, last7, leaders] = await Promise.all([
    impactFor(scope, startOf(period)),
    impactFor(scope, startOf("week")),
    db.user.findMany({
      where: { role: "STUDENT", active: true, ...(user.schoolId && { schoolId: user.schoolId }) },
      orderBy: { points: "desc" }, take: 5, select: { id: true, name: true, points: true, avatar: true },
    }),
  ]);

  const byType = Object.entries(
    data.scans.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.wasteType]: (acc[s.wasteType] ?? 0) + s.weightKg }), {}),
  ).sort((a, b) => b[1] - a[1]) as [WasteType, number][];
  const maxType = byType[0]?.[1] ?? 1;

  // Simple predictive insight: linear month-end projection from month-to-date pace.
  const now = new Date();
  const monthData = period === "month" ? data : await impactFor(scope, startOf("month"));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = round((monthData.kg / now.getDate()) * daysInMonth);
  const top = byType[0]?.[0];

  return (
    <>
      <Header title="Statistics" back={null} />
      <div className="flex flex-col gap-4 px-5">
        <nav className="flex gap-2">
          {Object.entries(PERIODS).map(([k, v]) => (
            <Link key={k} href={`/stats?p=${k}`} className={`chip ${k === period ? "chip-on" : ""}`}>{v}</Link>
          ))}
        </nav>

        <section className="card p-5"><Ring percent={data.recyclingRate} label="Recycling Rate" /></section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Last 7 days (kg)</h2>
          <Bars data={dailySeries(last7.scans)} />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Stat value={`${data.kg} kg`} label="Waste Reduced" />
          <Stat value={`${data.water} L`} label="Water Saved" />
        </div>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Environmental Impact</h2>
          <div className="flex justify-around text-center">
            <div><p className="text-lg font-semibold">{data.co2} kg</p><p className="text-xs text-mute">CO₂ avoided</p></div>
            <div><p className="flex items-center gap-1 text-lg font-semibold"><TreePine size={18} className="text-leaf" />{data.trees}</p><p className="text-xs text-mute">Tree-years of CO₂</p></div>
            <div><p className="text-lg font-semibold">{data.scans.length}</p><p className="text-xs text-mute">Items sorted</p></div>
          </div>
        </section>

        {byType.length > 0 && (
          <section className="card space-y-2 p-4">
            <h2 className="text-sm font-medium">By waste type</h2>
            {byType.map(([t, kg]) => (
              <div key={t} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0">{GUIDE[t].emoji} {GUIDE[t].name}</span>
                <div className="h-2 flex-1 rounded bg-panel"><div className="h-2 rounded" style={{ width: `${(kg / maxType) * 100}%`, background: GUIDE[t].binColor }} /></div>
                <span className="w-12 text-right text-mute">{round(kg)} kg</span>
              </div>
            ))}
          </section>
        )}

        <section className="card flex gap-3 p-4">
          <Sparkles className="shrink-0 text-leaf" />
          <div className="text-sm">
            <p className="font-medium text-leaf">AI insight</p>
            <p className="text-mute">At this pace you&apos;ll sort about <b className="text-white">{projected} kg</b> this month.
              {top && top !== "OTHER" && <> Your biggest stream is <b className="text-white">{GUIDE[top].name.toLowerCase()}</b>. Cutting it at the source (reusables, bulk buys) beats recycling.</>}
              {top === "OTHER" && <> Most of your waste isn&apos;t recyclable yet. Check the guide for swaps.</>}
            </p>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-medium">Leaderboard{user.school ? ` · ${user.school.name}` : ""}</h2>
          <ol className="space-y-2">
            {leaders.map((l, i) => (
              <li key={l.id} className={`flex items-center gap-3 text-sm ${l.id === user.id ? "text-leaf" : ""}`}>
                <span className="w-5 text-mute">{i + 1}</span><span>{l.avatar}</span><span className="flex-1">{l.name}</span><span>{l.points} pts</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
