import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FOOD_CATEGORIES, FOOD_DISPOSALS, FOOD_REASONS, FOOD_TIPS, RECIPES, foodSummary, type FoodCategory } from "@/lib/food";
import { dailySeries, peopleScope, startOf } from "@/lib/queries";
import { Bars, Header, Stat, timeAgo } from "@/components/ui";
import { FoodForm } from "./FoodForm";

export default async function Food() {
  const user = await requireUser();
  const people = peopleScope(user);
  const logs = await db.foodLog.findMany({ where: { user: people, createdAt: { gte: startOf("month") } }, orderBy: { createdAt: "desc" } });
  const s = foodSummary(logs);
  const byCat = Object.keys(FOOD_CATEGORIES).map((c) => ({ c: c as FoodCategory, kg: logs.filter((l) => l.category === c).reduce((t, l) => t + l.kg, 0) })).sort((a, b) => b.kg - a.kg);
  const byReason = Object.entries(FOOD_REASONS).map(([k, v]) => ({ label: v, kg: Math.round(logs.filter((l) => l.reason === k).reduce((t, l) => t + l.kg, 0) * 10) / 10 })).filter((r) => r.kg > 0);
  const topCat = byCat[0]?.kg ? byCat[0].c : "FRUIT_VEG";

  return (
    <>
      <Header title="Food Waste" />
      <div className="flex flex-col gap-4 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${s.totalKg} kg`} label="Wasted this month" />
          <Stat value={`${s.divertedPct}%`} label="Kept from landfill" />
          <Stat value={`${s.co2Kg} kg`} label="CO₂ footprint" />
        </div>
        <FoodForm />
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Food waste · last 7 days (kg)</h2>
          <Bars data={dailySeries(logs.map((l) => ({ weightKg: l.kg, createdAt: l.createdAt })))} />
        </section>
        {byReason.length > 0 && (
          <section className="card space-y-2 p-4">
            <h2 className="text-sm font-medium">Why food was wasted</h2>
            {byReason.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className="w-28">{r.label}</span>
                <div className="h-2 flex-1 rounded bg-panel"><div className="h-2 rounded bg-amber-400" style={{ width: `${(r.kg / Math.max(...byReason.map((x) => x.kg))) * 100}%` }} /></div>
                <span className="w-12 text-right text-mute">{r.kg} kg</span>
              </div>
            ))}
          </section>
        )}
        <section className="card p-4">
          <h2 className="text-sm font-medium text-leaf">Rescue recipes for {FOOD_CATEGORIES[topCat].slice(3).toLowerCase()}</h2>
          <p className="mb-2 text-xs text-mute">Based on what gets wasted most</p>
          <ul className="space-y-2 text-sm">{RECIPES[topCat].map((r) => <li key={r.name}><b>{r.name}</b> <span className="text-mute">: {r.how}</span></li>)}</ul>
        </section>
        <section className="card flex gap-3 p-4">
          <span className="text-2xl">💡</span>
          <p className="text-sm text-mute">{FOOD_TIPS[new Date().getDate() % FOOD_TIPS.length]}</p>
        </section>
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-sm font-medium">Recent logs</h2>
          <ul>
            {logs.slice(0, 10).map((l) => (
              <li key={l.id} className="flex justify-between border-b border-line px-4 py-3 text-sm last:border-0">
                <span>{FOOD_CATEGORIES[l.category as FoodCategory]?.slice(0, 2)} {l.item} <span className="text-xs text-mute">· {l.kg} kg · {FOOD_DISPOSALS[l.disposal as keyof typeof FOOD_DISPOSALS]}</span></span>
                <span className="text-xs text-mute">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
            {logs.length === 0 && <li className="px-4 py-3 text-sm text-mute">Nothing logged this month.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
