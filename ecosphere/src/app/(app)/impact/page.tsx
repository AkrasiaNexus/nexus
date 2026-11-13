import { Droplets, Leaf, TreePine, Users, Utensils, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { foodSummary } from "@/lib/food";
import { impactFor, startOf } from "@/lib/queries";
import { sdgIndicators } from "@/lib/sdg";
import { round } from "@/lib/waste";
import { Header, Stat } from "@/components/ui";

// Public sustainability data: platform-wide totals, no personal data.
export default async function Impact() {
  await requireUser();
  const month = startOf("month");
  const [all, food, totalUsers, activeUsers, reuseTrades, ewaste, eventsHeld] = await Promise.all([
    impactFor({}),
    db.foodLog.findMany({ select: { kg: true, disposal: true } }),
    db.user.count({ where: { active: true } }),
    db.user.count({ where: { active: true, OR: [{ scans: { some: { createdAt: { gte: month } } } }, { foodLogs: { some: { createdAt: { gte: month } } } }] } }),
    db.purchase.count({ where: { listing: { ownerId: { not: null } } } }),
    db.scan.aggregate({ where: { wasteType: "EWASTE" }, _sum: { weightKg: true } }),
    db.event.count(),
  ]);
  const f = foodSummary(food);
  const sdg = sdgIndicators({ recyclingRate: all.recyclingRate, foodDivertedPct: f.divertedPct, activeUsers, totalUsers, reuseTrades, ewasteKg: round(ewaste._sum.weightKg ?? 0), eventsHeld });

  return (
    <>
      <Header title="Environmental & Social Impact" />
      <div className="flex flex-col gap-4 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Trash2 size={18} />} value={`${all.kg} kg`} label="Total waste reduced" />
          <Stat icon={<Leaf size={18} />} value={`${all.recyclingRate}%`} label="Recycling rate" />
          <Stat icon={<Leaf size={18} />} value={`${all.co2} kg`} label="CO₂ avoided" />
          <Stat icon={<Droplets size={18} />} value={`${all.water} L`} label="Water saved" />
          <Stat icon={<TreePine size={18} />} value={all.trees} label="Trees equivalent" />
          <Stat icon={<Utensils size={18} />} value={`${f.divertedKg} kg`} label="Food waste diverted" />
        </div>
        <Stat icon={<Users size={18} />} value={`${activeUsers} / ${totalUsers}`} label="Community participation this month" />

        <section className="card space-y-4 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-[#bf8b2e] text-xl font-bold text-white">12</span>
            <div><h2 className="font-semibold">SDG 12 progress</h2><p className="text-xs text-mute">Responsible Consumption & Production · overall {sdg.overall}%</p></div>
          </div>
          {sdg.items.map((s) => (
            <div key={s.target}>
              <div className="flex justify-between text-sm"><span><b className="text-leaf">{s.target}</b> {s.title}</span><span>{s.progress}%</span></div>
              <div className="mt-1 h-2 rounded bg-panel"><div className="h-2 rounded bg-[#bf8b2e]" style={{ width: `${s.progress}%` }} /></div>
              <p className="mt-1 text-xs text-mute">{s.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-mute">Indicators are local proxies for the UN targets, measured from activity on EcoSphere.</p>
        </section>
        <p className="pb-2 text-center text-sm text-leaf">A cleaner environment · A healthier community · A sustainable future</p>
      </div>
    </>
  );
}
