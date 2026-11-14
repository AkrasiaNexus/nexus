import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactFor, startOf } from "@/lib/queries";
import { Header, Stat } from "@/components/ui";

export default async function Department() {
  const me = await requireUser(["EMPLOYEE"]);
  const department = me.department ?? "General";
  const [colleagues, month] = await Promise.all([
    db.user.findMany({ where: { role: "EMPLOYEE", department: me.department }, orderBy: { points: "desc" }, select: { id: true, name: true, points: true, avatar: true } }),
    impactFor({ user: { role: "EMPLOYEE", department: me.department } }, startOf("month")),
  ]);
  return (
    <>
      <Header title="My Department" back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        <p className="text-center text-white/65">{department}</p>
        <div className="grid grid-cols-3 gap-3"><Stat value={colleagues.length} label="Colleagues" /><Stat value={`${month.kg} kg`} label="Sorted this month" /><Stat value={`${month.recyclingRate}%`} label="Recycling rate" /></div>
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-medium">Department leaderboard</h3>
          <ol className="space-y-2 text-sm">
            {colleagues.map((c, i) => <li key={c.id} className={`flex gap-2 ${c.id === me.id ? "text-leaf" : ""}`}><span className="w-5 text-white/50">{i + 1}</span><span className="flex-1">{c.avatar} {c.name}</span><span>{c.points} pts</span></li>)}
          </ol>
        </section>
      </div>
    </>
  );
}
