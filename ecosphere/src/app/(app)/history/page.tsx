import Link from "next/link";
import { Award, ClipboardCheck, Coins, Gift, HandHeart, Leaf, ShoppingBag, Sparkles, Store, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { syncBadges, withDates } from "@/lib/queries";
import { BADGES } from "@/lib/rewards";
import { Header, IconCircle, timeAgo, type Tone } from "@/components/ui";

const TABS = ["All", "Points", "Scan", "Rewards", "Marketplace", "Donations"] as const;
type Tab = (typeof TABS)[number];
const RANGES = { "7": "7 days", "30": "30 days", "90": "90 days", all: "All time" } as const;
type Row = { id: string; at: Date; tabs: Tab[]; icon: React.ReactNode; tone: Tone; title: string; sub?: string; pts?: number };

// Ledger refType → history category, icon, tone.
const REF: Record<string, [Tab, React.ReactNode, Tone]> = {
  scan: ["Scan", <Leaf key="i" size={22} />, "green"],
  purchase: ["Marketplace", <ShoppingBag key="i" size={22} />, "orange"],
  sale: ["Marketplace", <Store key="i" size={22} />, "teal"],
  donation: ["Donations", <HandHeart key="i" size={22} />, "green"],
  challenge: ["Rewards", <Trophy key="i" size={22} />, "gold"],
  task: ["Rewards", <ClipboardCheck key="i" size={22} />, "teal"],
  unlock: ["Rewards", <Sparkles key="i" size={22} />, "gold"],
};
const OTHER: [Tab, React.ReactNode, Tone] = ["Rewards", <Coins key="i" size={22} />, "gold"];

export default async function History({ searchParams }: { searchParams: { t?: string; d?: string; msg?: string } }) {
  const user = await requireUser();
  const tab = TABS.find((t) => t === searchParams.t) ?? "All";
  const range = (searchParams.d ?? "30") in RANGES ? (searchParams.d ?? "30") as keyof typeof RANGES : "30";
  const since = range === "all" ? "1970-01-01" : new Date(Date.now() - Number(range) * 86_400_000).toISOString();
  await syncBadges(user.id);
  const sb = createClient();
  const [ledgerRes, freeRes, listingRes, badgeRes] = await Promise.all([
    sb.from("point_events").select("id, delta, reason, refType, createdAt").eq("userId", user.id).gte("createdAt", since).order("createdAt", { ascending: false }).limit(200),
    // Free claims move no points, so they're not in the ledger.
    sb.from("purchases").select("id, listingId, createdAt").eq("userId", user.id).eq("points", 0).gte("createdAt", since).limit(100),
    sb.from("listings").select("id, title, kind, createdAt").eq("ownerId", user.id).gte("createdAt", since).limit(100),
    sb.from("user_badges").select("badgeId, earnedAt").eq("userId", user.id).gte("earnedAt", since),
  ]);
  const free = withDates(freeRes.data, "createdAt");
  // Claimed listings go inactive (hidden by RLS); titles only for rows RLS already returned.
  const { data: freeItems } = free.length ? await admin().from("listings").select("id, title").in("id", free.map((f) => f.listingId)) : { data: [] };
  const title = new Map((freeItems ?? []).map((i) => [i.id as string, i.title as string]));

  const all: Row[] = [
    ...withDates(ledgerRes.data, "createdAt").map((e) => {
      const [cat, icon, tone] = REF[e.refType] ?? OTHER;
      return { id: e.id, at: e.createdAt, tabs: ["Points", cat] as Tab[], icon, tone, title: e.reason, pts: e.delta };
    }),
    ...free.map((f) => ({ id: f.id, at: f.createdAt, tabs: ["Marketplace"] as Tab[], icon: <Gift size={22} />, tone: "orange" as Tone, title: `Claimed: ${title.get(f.listingId) ?? "an item"}`, sub: "Free" })),
    ...withDates(listingRes.data, "createdAt").map((l) => ({
      id: l.id, at: l.createdAt, tabs: [l.kind === "DONATE" ? "Donations" : "Marketplace"] as Tab[], icon: <Store size={22} />, tone: "teal" as Tone,
      title: `${l.kind === "DONATE" ? "Donated" : l.kind === "EXCHANGE" ? "Offered to swap" : "Listed"}: ${l.title}`,
    })),
    ...withDates(badgeRes.data, "earnedAt").map((b) => ({ id: b.badgeId, at: b.earnedAt, tabs: ["Rewards"] as Tab[], icon: <Award size={22} />, tone: "gold" as Tone, title: "Earned badge", sub: BADGES.find((x) => x.id === b.badgeId)?.name })),
  ];
  const rows = all.filter((r) => tab === "All" || r.tabs.includes(tab)).sort((a, b) => b.at.getTime() - a.at.getTime());
  const net = rows.reduce((s, r) => s + (r.pts ?? 0), 0);
  const href = (t: string, d: string) => `/history?t=${t}&d=${d}`;

  return (
    <>
      <Header title="Activity History" back="/profile" />
      <div className="stagger flex flex-col gap-3 px-5">
        {searchParams.msg && <p role="status" className="card p-3 text-center text-sm text-leaf">{searchParams.msg.slice(0, 100)}</p>}
        <nav aria-label="Category" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {TABS.map((t) => <Link key={t} href={href(t, range)} aria-current={t === tab ? "page" : undefined} className={`chip shrink-0 ${t === tab ? "chip-on" : ""}`}>{t === "Scan" ? "Scans" : t}</Link>)}
        </nav>
        <nav aria-label="Date range" className="flex items-center gap-1 text-xs">
          {Object.entries(RANGES).map(([k, v]) => (
            <Link key={k} href={href(tab, k)} aria-current={k === range ? "true" : undefined} className={`rounded-full px-3 py-1.5 ${k === range ? "bg-card text-white" : "text-mute hover:text-white"}`}>{v}</Link>
          ))}
          {net !== 0 && <span className={`ml-auto ${net > 0 ? "text-leaf" : "text-orange-300"}`}>{net > 0 ? "+" : ""}{net} pts</span>}
        </nav>
        <ul className="stagger flex flex-col">
          {rows.map((r) => (
            <li key={r.tabs[0] + r.id} className="flex items-center gap-4 border-b border-white/[.05] py-3.5 last:border-0">
              <IconCircle tone={r.tone} size={46}>{r.icon}</IconCircle>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.title}</p>
                {r.sub && <p className="truncate text-sm text-white/70">{r.sub}</p>}
                {r.pts !== undefined && <p className={`text-sm ${r.pts > 0 ? "text-leaf" : "text-orange-300"}`}>{r.pts > 0 ? "+" : ""}{r.pts} pts</p>}
              </div>
              <span className="shrink-0 self-start text-[11px] text-white/50">{timeAgo(r.at)}</span>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="card p-6 text-center text-sm text-white/55">
              Nothing in this range. {range !== "all" && <Link href={href(tab, "all")} className="text-leaf underline">Show all time</Link>}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
