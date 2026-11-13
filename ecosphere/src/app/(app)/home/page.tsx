import Link from "next/link";
import { Bell, BookOpen, Droplets, Gift, Leaf, Recycle, ScanLine, School, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactFor, scanScope, startOf } from "@/lib/queries";
import { goalPercent } from "@/lib/rewards";
import { Ring, Stat } from "@/components/ui";

const SCOPE_LABEL = { STUDENT: "My impact", EMPLOYEE: "My impact", COMMUNITY: "My impact", PARENT: "My children", SCHOOL_ADMIN: "My school", SUPER_ADMIN: "Whole platform" };
const TIPS = [
  "Carry a reusable bottle: one person can avoid ~150 plastic bottles a year.",
  "Plan meals and store leftovers in clear boxes so they get eaten.",
  "Repair before you replace. Many gadgets just need a new battery.",
  "Rinse containers: one dirty item can contaminate a whole recycling batch.",
  "Buy loose fruit and veg to cut packaging waste.",
];

export default async function Home() {
  const user = await requireUser();
  const isPersonal = ["STUDENT", "EMPLOYEE", "COMMUNITY"].includes(user.role);
  const [month, unread, challenge] = await Promise.all([
    impactFor(scanScope(user), startOf("month")),
    db.notification.count({ where: { OR: [{ userId: user.id }, { userId: null }], createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } } }),
    db.challenge.findFirst({ where: { endsAt: { gte: new Date() } }, orderBy: { endsAt: "asc" } }),
  ]);
  const percent = isPersonal ? goalPercent(month.kg) : month.recyclingRate;

  const actions = [
    { href: "/scan", label: "Scan Waste", icon: ScanLine },
    { href: "/guide", label: "Guide", icon: BookOpen },
    { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    { href: "/rewards", label: "Rewards", icon: Gift },
    ...(user.role === "SCHOOL_ADMIN" ? [{ href: "/school", label: "School", icon: School }] : []),
    ...(user.role === "SUPER_ADMIN" ? [{ href: "/admin/users", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex flex-col gap-5 px-5 pt-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-2xl">{user.avatar}</span>
        <div className="flex-1">
          <p className="text-sm text-mute">Welcome back,</p>
          <p className="text-lg font-semibold">{user.name.split(" ")[0]}!</p>
        </div>
        <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-card">
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-leaf" />}
        </Link>
      </div>

      <section className="card relative overflow-hidden p-5 text-center">
        <p className="mb-2 text-xs uppercase tracking-wide text-mute">{SCOPE_LABEL[user.role]} · this month{user.school ? ` · ${user.school.name}` : ""}</p>
        <Ring percent={percent} label={isPersonal ? "Green Goal" : "Recycling Rate"} />
        <p className="mt-2 text-xs text-mute">{isPersonal ? `${month.kg} of 20 kg monthly goal` : `${month.scans.length} items sorted`}</p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Trash2 size={18} />} value={`${month.kg} kg`} label="Waste Reduced" />
        <Stat icon={<Leaf size={18} />} value={`${month.co2} kg`} label="CO₂ Avoided" />
        <Stat icon={<Droplets size={18} />} value={`${month.water} L`} label="Water Saved" />
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="card flex flex-col items-center gap-2 p-3 text-center text-[11px] hover:border-leaf">
              <Icon className="text-leaf" size={22} />{label}
            </Link>
          ))}
        </div>
      </section>

      {challenge && (
        <Link href="/rewards" className="card flex items-center gap-3 p-4 hover:border-leaf">
          <Recycle className="text-leaf" />
          <div className="flex-1">
            <p className="text-sm font-medium">Challenge: {challenge.title}</p>
            <p className="text-xs text-mute">+{challenge.rewardPoints} pts · ends {challenge.endsAt.toLocaleDateString()}</p>
          </div>
        </Link>
      )}

      <section className="card flex gap-3 p-4">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-sm font-medium text-leaf">Eco-tip of the day</p>
          <p className="text-sm text-mute">{TIPS[new Date().getDate() % TIPS.length]}</p>
        </div>
      </section>
    </div>
  );
}
