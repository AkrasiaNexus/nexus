import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { syncBadges, withDates } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { backgroundCss, borderColor } from "@/components/Avatar";
import { equipItem, unlockItem } from "../../reward-actions";
import { timeAgo } from "@/components/ui";
import { BADGES } from "@/lib/rewards";
import { LeafLogo } from "@/components/art";
import { CountUp } from "@/components/Motion";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Header, IconCircle, type Tone } from "@/components/ui";
import { ChallengeList } from "@/components/ChallengeList";


export default async function Rewards({ searchParams }: { searchParams: { all?: string } }) {
  const user = await requireUser();
  const showAll = searchParams.all === "1";
  const sb = createClient();
  const [earned, itemsRes, unlocksRes, ledgerRes] = await Promise.all([
    syncBadges(user.id),
    sb.from("reward_items").select("*").eq("active", true).order("price"),
    sb.from("user_unlocks").select("itemId").eq("userId", user.id),
    sb.from("point_events").select("*").eq("userId", user.id).order("createdAt", { ascending: false }).limit(15),
  ]);
  const owned = new Set((unlocksRes.data ?? []).map((u) => u.itemId as string));
  const equipped = new Set([user.equippedBackground, user.equippedBorder, user.equippedSticker].filter(Boolean));
  const items = (itemsRes.data ?? []) as { id: string; kind: string; name: string; value: string; price: number }[];
  const ledger = withDates(ledgerRes.data, "createdAt");
  const SHOP: [string, string][] = [["STICKER", "Stickers"], ["BACKGROUND", "Profile backgrounds"], ["BORDER", "Borders"], ["TOKEN", "Eco tokens"]];
  const badges = showAll ? BADGES : BADGES.filter((b) => earned.has(b.id)).concat(BADGES.filter((b) => !earned.has(b.id))).slice(0, 4);

  return (
    <>
      <Header title="EcoCred Rewards" />
      <div className="flex flex-col gap-6 px-5">
        <section className="flex flex-col items-center gap-5 pt-6">
          <div className="relative grid h-40 w-40 place-items-center rounded-full border-2 border-leaf/50 bg-[radial-gradient(circle,#1f4a26,#0b1a0e)] shadow-[0_0_40px_rgba(134,214,126,.25)]">
            <span className="blur-in absolute -top-9"><LeafLogo size={70} /></span>
            <div className="pt-4 text-center"><p className="text-4xl font-bold"><CountUp value={user.points} /></p><p className="text-sm text-white/70">Points</p></div>
          </div>
          <Link href="/marketplace" className="btn w-full py-3.5">Redeem Rewards</Link>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Badges</h2>
            <Link href={showAll ? "/rewards" : "/rewards?all=1"} className="flex items-center gap-1 text-sm text-leaf">{showAll ? "Show less" : "View All"} <ArrowRight size={14} /></Link>
          </div>
          <ul className={showAll ? "grid grid-cols-4 gap-4" : "flex justify-between"}>
            {badges.map((b, i) => (
              <li key={b.id} className="pop-in" style={{ animationDelay: `${150 + i * 75}ms` }} title={`${b.name}${earned.has(b.id) ? "" : " (locked)"}`}>
                <div className={`flex flex-col items-center gap-1 ${earned.has(b.id) ? "" : "opacity-30 grayscale"}`}>
                <IconCircle tone={b.tone as Tone} size={64}><span className="text-3xl">{b.emoji}</span></IconCircle>
                {showAll && <span className="text-center text-[10px] leading-tight">{b.name}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Customise Your Profile</h2>
          <AvatarPicker current={user.avatar} limit={3} />
          <Link href="/settings#avatar" className="mt-3 inline-block text-xs text-leaf">More characters →</Link>
        </section>

        <section id="shop" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">Reward shop</h2>
          <p className="mb-3 text-xs text-white/50">Spend EcoCreds on looks for your profile. EcoCreds are checked and charged on the server.</p>
          <div className="space-y-4">
            {SHOP.map(([kind, title]) => (
              <div key={kind}>
                <h3 className="mb-2 text-sm text-white/70">{title}</h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.filter((i) => i.kind === kind).map((i) => {
                    const has = owned.has(i.id), on = equipped.has(i.id);
                    return (
                      <li key={i.id} className={`card flex flex-col items-center gap-1.5 p-3 text-center ${on ? "!border-leaf" : ""}`}>
                        <span className="grid h-12 w-12 place-items-center rounded-full text-2xl" style={{
                          background: kind === "BACKGROUND" ? backgroundCss(i.value) : "#202523",
                          boxShadow: kind === "BORDER" ? `0 0 0 4px ${borderColor(i.value)}` : undefined,
                        }}>{kind === "STICKER" || kind === "TOKEN" ? i.value : ""}</span>
                        <span className="text-xs">{i.name}</span>
                        {has ? (
                          <form action={equipItem.bind(null, i.id, !on)} className="w-full"><button className={`w-full rounded-full py-1.5 text-xs ${on ? "border border-line" : "bg-leaf font-semibold text-ink"}`}>{on ? "Unequip" : "Equip"}</button></form>
                        ) : (
                          <form action={async () => { "use server"; await unlockItem(i.id); }} className="w-full">
                            <button disabled={user.points < i.price} className="w-full rounded-full border border-line py-1.5 text-xs disabled:opacity-40">Unlock · {i.price} EC</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Challenges</h2>
          <ChallengeList userId={user.id} limit={2} />
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4"><h2 className="text-sm font-medium">EcoCreds history</h2><Link href="/history?t=Points" className="text-xs text-leaf">All →</Link></div>
          <ul>
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span className="flex-1 truncate text-white/75">{e.reason}</span>
                <span className="text-[11px] text-white/40">{timeAgo(e.createdAt)}</span>
                <span className={`w-14 text-right ${e.delta >= 0 ? "text-leaf" : "text-orange-300"}`}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
              </li>
            ))}
            {ledger.length === 0 && <li className="px-4 py-3 text-xs text-white/50">No EcoCreds yet. Scan an item to earn your first.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
