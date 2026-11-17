import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Droplet, Recycle, SlidersHorizontal, Sparkles, TreePine, X } from "lucide-react";
import type { Role, WasteType } from "@/lib/types";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { impactFiltered, impactFor, scanScope, startOf, type AdminFilters } from "@/lib/queries";
import { GUIDE, WASTE_TYPES, impact, round } from "@/lib/waste";
import { WEEKDAYS, changePct, heatmapGrid, periodRange, seriesBetween, seriesFor, type Period } from "@/lib/charts";
import { Header, Heatmap, LineChart, Ring } from "@/components/ui";
import { Glyph, WASTE_GLYPH } from "@/components/Glyph";
import { Critter } from "@/components/Critter";

const PERIODS: Record<Period, string> = { day: "Today", week: "This Week", month: "This Month", year: "This Year" };
const PREV: Record<Period, string> = { day: "yesterday", week: "last week", month: "last month", year: "last year" };
const BOARDS = ["Students", "Classes", "Schools"] as const;
const SCOPE_TITLE: Partial<Record<Role, string>> = {
  STUDENT: "Your sorting", EMPLOYEE: "Your sorting", COMMUNITY: "Your sorting", PARENT: "Your children",
  TEACHER: "Your class", HEALTH_MONITOR: "Your class", SCHOOL_ADMIN: "Your school", COMMUNITY_ADMIN: "Your community", SUPER_ADMIN: "Whole platform",
};
const ROLE_FILTERS: Role[] = ["STUDENT", "TEACHER", "EMPLOYEE", "COMMUNITY", "PARENT"];
type Params = { p?: string; b?: string; t?: string; school?: string; community?: string; cls?: string; role?: string; from?: string; to?: string };

function Delta({ pct, prev }: { pct: number | null; prev: string }) {
  if (pct === null) return <span className="text-[11px] text-white/40">no data {prev}</span>;
  const up = pct >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-[11px] ${up ? "text-leaf" : "text-orange-300"}`}>{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(pct)}% vs {prev}</span>;
}

export default async function Stats({ searchParams: q }: { searchParams: Params }) {
  const user = await requireUser();
  const period: Period = q.p && q.p in PERIODS ? (q.p as Period) : "week";
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SCHOOL_ADMIN";
  const type = WASTE_TYPES.find((t) => t === q.t) as WasteType | undefined;
  const boards = user.schoolId ? BOARDS : (["Schools"] as const);
  const board = boards.find((b) => b === q.b) ?? boards[0];
  const href = (extra: Params) => `/stats?${new URLSearchParams(Object.entries({ ...q, ...extra }).filter(([, v]) => v) as [string, string][])}`;

  // Range: a custom admin date range, else the selected period; "previous" is the same length just before.
  const custom = isAdmin && q.from && q.to && !isNaN(+new Date(q.from)) && +new Date(q.to) > +new Date(q.from);
  const { start, end } = custom ? { start: new Date(q.from!), end: new Date(new Date(q.to!).getTime() + 86_400_000) } : periodRange(period);
  const prevRange = custom ? { start: new Date(+start - (+end - +start)), end: start } : periodRange(period, -1);
  const filters: AdminFilters = { school: q.school, community: q.community, cls: q.cls, role: ROLE_FILTERS.includes(q.role as Role) ? q.role : undefined };
  const load = (s: Date, e?: Date) => (isAdmin ? impactFiltered(filters, s, e) : impactFor(scanScope(user), s, e));

  const sb = createClient();
  const [data, prev, last4w, allStudents, schoolRes, communities] = await Promise.all([
    load(start, end), load(prevRange.start, prevRange.end), load(new Date(Date.now() - 28 * 86_400_000)),
    sb.from("public_profiles").select("id, name, points, avatar, grade, schoolId").eq("role", "STUDENT").eq("active", true).order("points", { ascending: false }),
    sb.rpc("school_totals"),
    user.role === "SUPER_ADMIN" ? sb.from("communities").select("id, name").order("name") : null,
  ]);
  const students = (allStudents.data ?? []) as { id: string; name: string; points: number; avatar: string; grade: string | null; schoolId: string | null }[];
  const leaders = students.filter((x) => x.schoolId === user.schoolId);
  const schools = (schoolRes.data ?? []) as { id: string; name: string; points: number }[];
  const sum = (xs: { points: number }[]) => xs.reduce((t, x) => t + x.points, 0);
  const rows = board === "Students"
    ? leaders.slice(0, 5).map((l) => ({ key: l.id, label: l.name, avatar: l.avatar, points: l.points, me: l.id === user.id }))
    : board === "Classes"
      ? Array.from(new Set(leaders.map((l) => l.grade ?? "—"))).map((g) => ({ key: g, label: `Class ${g}`, points: sum(leaders.filter((l) => (l.grade ?? "—") === g)), me: g === user.grade }))
        .sort((a, b) => b.points - a.points).slice(0, 5)
      : schools.map((s) => ({ key: s.id, label: s.name, points: Number(s.points), me: s.id === user.schoolId })).sort((a, b) => b.points - a.points);

  const kgBy = (scans: { wasteType: WasteType; weightKg: number }[]) =>
    scans.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.wasteType]: (acc[s.wasteType] ?? 0) + s.weightKg }), {});
  const nowBy = kgBy(data.scans), prevBy = kgBy(prev.scans);
  const byType = (WASTE_TYPES.filter((t) => nowBy[t] || prevBy[t]) as WasteType[]).sort((a, b) => (nowBy[b] ?? 0) - (nowBy[a] ?? 0));
  const maxType = Math.max(0.1, ...byType.flatMap((t) => [nowBy[t] ?? 0, prevBy[t] ?? 0]));
  const shown = type ? data.scans.filter((s) => s.wasteType === type) : data.scans;
  const typeImpact = type ? impact(shown) : null;
  const series = custom ? seriesBetween(start, end, shown) : seriesFor(period, start, shown);

  // Simple predictive insight: linear month-end projection from month-to-date pace.
  const now = new Date();
  const monthData = period === "month" && !custom ? data : await load(startOf("month"));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = round((monthData.kg / now.getDate()) * daysInMonth);
  const top = byType[0];
  const prevLabel = custom ? "previous range" : PREV[period];
  const activeFilters = [q.school, q.community, q.cls, filters.role, custom ? "range" : ""].filter(Boolean).length;

  return (
    <>
      <Header title="Statistics" back={null} />
      <div className="stagger flex flex-col gap-4 px-5">
        <p className="-mt-2 text-sm text-white/55">{SCOPE_TITLE[user.role] ?? "Your sorting"}{user.school ? ` · ${user.school.name}` : ""}</p>
        <nav className="relative grid grid-cols-4 rounded-2xl border border-white/[.06] bg-card p-1">
          <span aria-hidden className="slide-anim absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-xl bg-leaf/90 transition-transform duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ transform: `translateX(${Object.keys(PERIODS).indexOf(period) * 100}%)`, opacity: custom ? 0 : 1 }} />
          {(Object.keys(PERIODS) as Period[]).map((k) => (
            <Link key={k} href={href({ p: k, from: "", to: "" })} aria-current={k === period && !custom ? "page" : undefined}
              className={`relative rounded-xl py-2 text-center text-xs transition-colors duration-200 ${k === period && !custom ? "font-semibold text-ink" : "text-white/75"}`}>{PERIODS[k]}</Link>
          ))}
        </nav>

        {isAdmin && (
          <details className="card group p-4" open={activeFilters > 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal size={16} className="text-leaf" />Filters{activeFilters ? <span className="chip chip-on">{activeFilters}</span> : null}
              {activeFilters > 0 && <Link href="/stats" className="ml-auto text-xs text-white/50">Clear</Link>}
            </summary>
            <form className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
              <input type="hidden" name="p" value={period} />
              {user.role === "SUPER_ADMIN" && (
                <label>School<select name="school" defaultValue={q.school ?? ""} className="input mt-1 py-2"><option value="">All schools</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              )}
              {user.role === "SUPER_ADMIN" && (
                <label>Community<select name="community" defaultValue={q.community ?? ""} className="input mt-1 py-2"><option value="">All communities</option>{(communities?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              )}
              <label>Class<input name="cls" defaultValue={q.cls ?? ""} placeholder="e.g. Class 10" maxLength={20} className="input mt-1 py-2" /></label>
              <label>Role<select name="role" defaultValue={filters.role ?? ""} className="input mt-1 py-2"><option value="">All roles</option>{ROLE_FILTERS.map((r) => <option key={r} value={r}>{r.replace("_", " ").toLowerCase()}</option>)}</select></label>
              <label>From<input type="date" name="from" defaultValue={q.from ?? ""} className="input mt-1 py-2" /></label>
              <label>To<input type="date" name="to" defaultValue={q.to ?? ""} className="input mt-1 py-2" /></label>
              <button className="btn col-span-2 py-2 text-sm">Apply filters</button>
            </form>
          </details>
        )}

        <div className="py-2"><Ring percent={data.recyclingRate} label="Recycling Rate" size={190} /></div>

        {type && (
          <section className="card flex items-center gap-3 p-4">
            <Glyph name={WASTE_GLYPH[type]} className="h-9 w-9 text-white/85" />
            <div className="flex-1">
              <p className="font-medium">{GUIDE[type].name} breakdown</p>
              <p className="text-xs text-white/55">{typeImpact!.kg} kg · {data.kg ? Math.round((typeImpact!.kg / data.kg) * 100) : 0}% of all waste · {typeImpact!.co2} kg CO₂ · {typeImpact!.water} L water</p>
              <Link href={`/guide?type=${type}`} className="text-xs text-leaf">How to recycle {GUIDE[type].name.toLowerCase()} →</Link>
            </div>
            <Link href={href({ t: "" })} aria-label="Show all waste types" className="rounded-full p-2 hover:bg-white/5"><X size={18} /></Link>
          </section>
        )}

        <LineChart data={series} />

        <div className="grid grid-cols-2 gap-3">
          <div className="card flex items-center gap-3 p-4">
            <Recycle className="shrink-0 text-leaf" size={28} />
            <div><p className="text-lg font-semibold">{data.kg} kg</p><p className="text-[11px] text-white/60">Waste sorted</p><Delta pct={changePct(data.kg, prev.kg)} prev={prevLabel} /></div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <Droplet className="shrink-0 text-leaf" size={26} />
            <div><p className="text-lg font-semibold">{data.water} L</p><p className="text-[11px] text-white/60">Water saved</p><Delta pct={changePct(data.water, prev.water)} prev={prevLabel} /></div>
          </div>
        </div>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Environmental Impact</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[.03] p-3"><span className="text-sm font-semibold text-leaf">CO₂</span><div><p className="font-semibold">{data.co2} kg</p><p className="text-[11px] text-white/60">Avoided</p></div></div>
            <div className="flex items-center gap-2 rounded-xl bg-white/[.03] p-3"><TreePine size={22} className="text-leaf" /><div><p className="font-semibold">{data.trees} Trees</p><p className="text-[11px] text-white/60">CO₂-years</p></div></div>
            <div className="flex items-center gap-2 rounded-xl bg-white/[.03] p-3"><Recycle size={20} className="text-leaf" /><div><p className="font-semibold">{data.scans.length}</p><p className="text-[11px] text-white/60">Items sorted</p></div></div>
          </div>
          <p className="mt-2 text-[10px] text-white/35">Impact uses published average factors per material; demo accounts contain sample data.</p>
        </section>

        {byType.length > 0 && (
          <section className="card space-y-2.5 p-4">
            <div className="flex items-baseline justify-between"><h2 className="text-sm font-medium">By waste type</h2><span className="text-[11px] text-white/40">vs {prevLabel} · tap for details</span></div>
            {byType.map((t) => (
              <Link key={t} href={href({ t: t === type ? "" : t })} aria-current={t === type ? "true" : undefined}
                className={`block rounded-lg px-1 py-0.5 text-xs transition-colors hover:bg-white/[.03] ${type && t !== type ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="flex w-24 shrink-0 items-center gap-1.5"><Glyph name={WASTE_GLYPH[t]} className="h-4 w-4 shrink-0 text-white/70" />{GUIDE[t].name}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-2 rounded bg-panel"><div className="grow-x h-2 rounded" style={{ width: `${((nowBy[t] ?? 0) / maxType) * 100}%`, background: GUIDE[t].binColor }} /></div>
                    <div className="h-1 rounded bg-panel"><div className="grow-x h-1 rounded bg-white/25" style={{ width: `${((prevBy[t] ?? 0) / maxType) * 100}%` }} /></div>
                  </div>
                  <span className="w-12 text-right text-mute">{round(nowBy[t] ?? 0)} kg</span>
                </div>
              </Link>
            ))}
          </section>
        )}

        <section className="card flex gap-3 p-4">
          <Sparkles className="shrink-0 text-leaf" />
          <div className="text-sm">
            <p className="font-medium text-leaf">AI insight</p>
            <p className="text-mute">At this pace about <b className="text-white">{projected} kg</b> will be sorted this month.
              {top && top !== "OTHER" && <> The biggest stream is <b className="text-white">{GUIDE[top].name.toLowerCase()}</b>. Cutting it at the source (reusables, bulk buys) beats recycling.</>}
              {top === "OTHER" && <> Most of this waste isn&apos;t recyclable yet. Check the guide for swaps.</>}
            </p>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 text-sm font-medium">Waste heat map · last 4 weeks (kg)</h2>
          <p className="mb-2 text-[11px] text-mute">Darker = more waste sorted. Spot the days bins fill up.</p>
          <Heatmap grid={heatmapGrid(last4w.scans)} rowLabels={["3 wks ago", "2 wks ago", "Last wk", "This wk"]} colLabels={WEEKDAYS} />
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">EcoCreds leaderboard</h2>
            <nav className="flex gap-1">{boards.map((b) => <Link key={b} href={href({ b })} className={`chip ${b === board ? "chip-on" : ""}`}>{b}</Link>)}</nav>
          </div>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className={`flex items-center gap-3 text-sm ${r.me ? "text-leaf" : ""}`}>
                <span className="w-5 text-mute">{i + 1}</span><span className="flex flex-1 items-center gap-2">{"avatar" in r && typeof r.avatar === "string" && <Critter avatar={r.avatar} size={22} />}{r.label}</span><span>{r.points} EC</span>
              </li>
            ))}
            {rows.length === 0 && <li className="text-xs text-white/50">No rankings yet.</li>}
          </ol>
        </section>
        <Link href="/impact" className="btn-ghost text-sm">See SDG 12 & community impact →</Link>
      </div>
    </>
  );
}
