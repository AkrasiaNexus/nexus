import { Droplets, Leaf, Recycle, TreePine, Users, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { impactFor, startOf } from "@/lib/queries";
import { sdgIndicators } from "@/lib/sdg";
import { round } from "@/lib/waste";
import { Header, Stat } from "@/components/ui";

// Public sustainability data: platform-wide totals, no personal data.
export default async function Impact() {
  await requireUser();
  const month = startOf("month");
  // Platform-wide public totals only (no personal data leaves the server).
  const db = admin();
  const [all, users, activeScans, peerPurchases, eventCount] = await Promise.all([
    impactFor("platform"),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("scans").select("userId").gte("createdAt", month.toISOString()),
    db.from("purchases").select("id, listing:listings!inner(ownerId)").not("listing.ownerId", "is", null),
    db.from("events").select("id", { count: "exact", head: true }),
  ]);
  const totalUsers = users.count ?? 0;
  const activeUsers = new Set((activeScans.data ?? []).map((x) => x.userId)).size;
  const reuseTrades = peerPurchases.data?.length ?? 0;
  const ewaste = { _sum: { weightKg: all.scans.filter((x) => x.wasteType === "EWASTE").reduce((t, x) => t + x.weightKg, 0) } };
  const eventsHeld = eventCount.count ?? 0;
  const sdg = sdgIndicators({ recyclingRate: all.recyclingRate, activeUsers, totalUsers, reuseTrades, ewasteKg: round(ewaste._sum.weightKg ?? 0), eventsHeld });

  return (
    <>
      <Header title="Environmental & Social Impact" />
      <div className="stagger flex flex-col gap-4 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Trash2 size={18} />} value={`${all.kg} kg`} label="Total waste reduced" />
          <Stat icon={<Leaf size={18} />} value={`${all.recyclingRate}%`} label="Recycling rate" />
          <Stat icon={<Leaf size={18} />} value={`${all.co2} kg`} label="CO₂ avoided" />
          <Stat icon={<Droplets size={18} />} value={`${all.water} L`} label="Water saved" />
          <Stat icon={<TreePine size={18} />} value={all.trees} label="Trees equivalent" />
          <Stat icon={<Recycle size={18} />} value={reuseTrades} label="Items reused" />
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
              <div className="mt-1 h-2 rounded bg-panel"><div className="grow-x h-2 rounded bg-[#bf8b2e]" style={{ width: `${s.progress}%` }} /></div>
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
