import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { setRewardItem, setRewardRule } from "../../../admin-actions";

export default async function AdminRewards() {
  await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const [{ data: rules }, { data: items }, { data: unlocks }] = await Promise.all([
    db.from("reward_rules").select("action, points, description").order("action"),
    db.from("reward_items").select("id, kind, name, value, price, active").order("kind").order("price"),
    db.from("user_unlocks").select("itemId"),
  ]);
  const owned = (id: string) => (unlocks ?? []).filter((u) => u.itemId === id).length;
  return (
    <>
      <Header title="Rewards" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 font-semibold">Point rules</h2>
          <p className="px-4 text-xs text-mute">Points earned per action. Changes apply to new activity only.</p>
          <ul className="mt-2">
            {rules?.map((r) => (
              <li key={r.action} className="border-t border-line">
                <ActionForm action={setRewardRule.bind(null, r.action)} submit="Save" className="!flex-row items-center gap-3 rounded-none border-0 bg-transparent">
                  <span className="flex-1 text-sm">{r.description}</span>
                  <input name="points" type="number" min={0} max={1000} required defaultValue={r.points} aria-label={`Points for ${r.description}`} className="input w-20 py-1.5" />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 font-semibold">Cosmetics catalogue</h2>
          <p className="px-4 text-xs text-mute">Hidden items stay with people who already unlocked them.</p>
          <ul className="mt-2">
            {items?.map((it) => (
              <li key={it.id} className="border-t border-line">
                <ActionForm action={setRewardItem.bind(null, it.id)} submit="Save" className="!flex-row flex-wrap items-center gap-3 rounded-none border-0 bg-transparent">
                  <span className="min-w-0 flex-1 text-sm">{it.name} <span className="text-xs text-mute">· {it.kind.toLowerCase()} · {owned(it.id)} owned</span></span>
                  <input name="price" type="number" min={0} max={10000} required defaultValue={it.price} aria-label={`Price of ${it.name}`} className="input w-20 py-1.5" />
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="active" defaultChecked={it.active} className="accent-[#a2d47e]" />Listed</label>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-center text-xs text-mute">Manual point adjustments live on each user&apos;s page in <Link href="/admin/users" className="text-leaf underline">Manage Users</Link>.</p>
      </div>
    </>
  );
}
