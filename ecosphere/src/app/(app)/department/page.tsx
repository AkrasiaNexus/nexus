import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { impactFor, startOf } from "@/lib/queries";
import { Header, Stat } from "@/components/ui";
import { Critter } from "@/components/Critter";

export default async function Department() {
  const me = await requireUser(["EMPLOYEE"]);
  const department = me.department ?? "General";
  const [colleagueRes, month] = await Promise.all([
    createClient().from("public_profiles").select("id, name, points, avatar").eq("role", "EMPLOYEE").eq("department", me.department ?? "").order("points", { ascending: false }),
    impactFor("department", startOf("month")),
  ]);
  const colleagues = (colleagueRes.data ?? []) as { id: string; name: string; points: number; avatar: string }[];
  return (
    <>
      <Header title="My Department" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <p className="text-center text-white/65">{department}</p>
        <div className="grid grid-cols-3 gap-3"><Stat value={colleagues.length} label="Colleagues" /><Stat value={`${month.kg} kg`} label="Sorted this month" /><Stat value={`${month.recyclingRate}%`} label="Recycling rate" /></div>
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-medium">Department leaderboard</h3>
          <ol className="space-y-2 text-sm">
            {colleagues.map((c, i) => <li key={c.id} className={`flex gap-2 ${c.id === me.id ? "text-leaf" : ""}`}><span className="w-5 text-white/50">{i + 1}</span><span className="flex flex-1 items-center gap-2"><Critter avatar={c.avatar} size={22} />{c.name}</span><span>{c.points} EC</span></li>)}
          </ol>
        </section>
      </div>
    </>
  );
}
