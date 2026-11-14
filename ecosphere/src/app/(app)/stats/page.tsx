import Link from "next/link";
import { Droplet, Recycle, Sparkles, TreePine } from "lucide-react";
import type { WasteType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactFor, scanScope, startOf } from "@/lib/queries";
import { GUIDE, round } from "@/lib/waste";
import { WEEKDAYS, heatmapGrid, periodRange, seriesFor } from "@/lib/charts";
import { Header, Heatmap, LineChart, Ring } from "@/components/ui";

const PERIODS = { week: "This Week", month: "This Month", year: "This Year" } as const;
type Period = keyof typeof PERIODS;

const BOARDS = ["Students", "Classes", "Schools"] as const;

export default async function Stats({ searchParams }: { searchParams: { p?: string; b?: string } }) {
  const user = await requireUser();
  const period: Period = searchParams.p && searchParams.p in PERIODS ? (searchParams.p as Period) : "week";
  const board = BOARDS.find((b) => b === searchParams.b) ?? "Students";
  const scope = scanScope(user);
  const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000);
  const { start, end } = periodRange(period);
  const [data, last4w, leaders, schools] = await Promise.all([
    impactFor(scope, start, end),
    impactFor(scope, fourWeeksAgo),
    db.user.findMany({
      where: { role: "STUDENT", active: true, ...(user.schoolId && { schoolId: user.schoolId }) },
      orderBy: { points: "desc" }, select: { id: true, name: true, points: true, avatar: true, grade: true, schoolId: true },
    }),
    db.school.findMany({ include: { users: { where: { role: "STUDENT", active: true }, select: { points: true } } } }),
  ]);
  const sum = (xs: { points: number }[]) => xs.reduce((t, x) => t + x.points, 0);
  const rows = board === "Students"
    ? leaders.slice(0, 5).map((l) => ({ key: l.id, label: `${l.avatar} ${l.name}`, points: l.points, me: l.id === user.id }))
    : board === "Classes"
      ? Array.from(new Set(leaders.map((l) => l.grade ?? "—"))).map((g) => ({ key: g, label: `Class ${g}`, points: sum(leaders.filter((l) => (l.grade ?? "—") === g)), me: g === user.grade }))
        .sort((a, b) => b.points - a.points).slice(0, 5)
      : schools.map((s) => ({ key: s.id, label: s.name, points: sum(s.users), me: s.id === user.schoolId })).sort((a, b) => b.points - a.points);

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
        <nav className="flex gap-1 rounded-2xl border border-white/[.06] bg-card p-1">
          {Object.entries(PERIODS).map(([k, v]) => (
            <Link key={k} href={`/stats?p=${k}&b=${board}`} className={`flex-1 rounded-xl py-2 text-center text-xs ${k === period ? "bg-leaf/90 font-semibold text-ink" : "text-white/75"}`}>{v}</Link>
          ))}
        </nav>

        <div className="py-2"><Ring percent={data.recyclingRate} label="Recycling Rate" size={190} /></div>

        <LineChart data={seriesFor(period, start, data.scans)} />

        <div className="grid grid-cols-2 gap-3">
          <div className="card flex items-center justify-center gap-3 p-4">
            <Recycle className="text-leaf" size={30} />
            <div><p className="text-lg font-semibold">{data.kg} kg</p><p className="text-[11px] text-white/60">Waste Reduced</p></div>
          </div>
          <div className="card flex items-center justify-center gap-3 p-4">
            <Droplet className="text-leaf" size={26} />
            <div><p className="text-lg font-semibold">{data.water} L</p><p className="text-[11px] text-white/60">Water Saved</p></div>
          </div>
        </div>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Environmental Impact</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[.03] p-3"><span className="text-sm font-semibold text-leaf">CO₂</span><div><p className="font-semibold">{data.co2} kg</p><p className="text-[11px] text-white/60">Avoided</p></div></div>
            <div className="flex items-center gap-2 rounded-xl bg-white/[.03] p-3"><TreePine size={22} className="text-leaf" /><div><p className="font-semibold">{data.trees} Trees</p><p className="text-[11px] text-white/60">Saved (CO₂-years)</p></div></div>
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
          <h2 className="mb-1 text-sm font-medium">Waste heat map · last 4 weeks (kg)</h2>
          <p className="mb-2 text-[11px] text-mute">Darker = more waste sorted. Spot the days your bins fill up.</p>
          <Heatmap grid={heatmapGrid(last4w.scans)} rowLabels={["3 wks ago", "2 wks ago", "Last wk", "This wk"]} colLabels={WEEKDAYS} />
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Green points leaderboard</h2>
            <nav className="flex gap-1">{BOARDS.map((b) => <Link key={b} href={`/stats?p=${period}&b=${b}`} className={`chip ${b === board ? "chip-on" : ""}`}>{b}</Link>)}</nav>
          </div>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className={`flex items-center gap-3 text-sm ${r.me ? "text-leaf" : ""}`}>
                <span className="w-5 text-mute">{i + 1}</span><span className="flex-1">{r.label}</span><span>{r.points} pts</span>
              </li>
            ))}
          </ol>
        </section>
        <Link href="/impact" className="btn-ghost text-sm">See SDG 12 & community impact →</Link>
      </div>
    </>
  );
}
