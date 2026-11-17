import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { publicNames } from "@/lib/queries";
import { ItemArt } from "@/components/ItemArt";
import { Header, timeAgo } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pending approval", tone: "text-gold" },
  APPROVED: { label: "Live", tone: "text-leaf" },
  REJECTED: { label: "Rejected", tone: "text-red-400" },
  REMOVED: { label: "Removed by moderator", tone: "text-red-400" },
};

type Listing = { id: string; title: string; emoji: string; imageUrl: string | null; status: string; active: boolean; moderationNote: string | null; pricePoints: number };
type Purchase = { id: string; userId: string; listingId: string; points: number; createdAt: string };

export default async function Mine({ searchParams }: { searchParams: { tab?: string; msg?: string } }) {
  const user = await requireUser();
  const sb = createClient();
  const tab = searchParams.tab === "tx" ? "tx" : "listings";
  const [{ data: listings }, { data: tx }] = await Promise.all([
    sb.from("listings").select("id, title, emoji, imageUrl, status, active, moderationNote, pricePoints").eq("ownerId", user.id).order("createdAt", { ascending: false }),
    // RLS returns my purchases plus sales on my listings.
    sb.from("purchases").select("id, userId, listingId, points, createdAt").order("createdAt", { ascending: false }).limit(100),
  ]);
  const mine = (listings ?? []) as Listing[];
  const purchases = (tx ?? []) as Purchase[];
  // Claimed items go inactive (hidden by RLS), so read titles with the admin client, limited to rows RLS already gave us.
  const ids = Array.from(new Set(purchases.map((p) => p.listingId)));
  const { data: items } = ids.length ? await admin().from("listings").select("id, title, emoji").in("id", ids) : { data: [] };
  const item = new Map((items ?? []).map((i) => [i.id as string, i as { title: string; emoji: string }]));
  const names = await publicNames(purchases.filter((p) => p.userId !== user.id).map((p) => p.userId));
  return (
    <>
      <Header title="My marketplace" back="/marketplace" />
      <div className="stagger flex flex-col gap-4 px-5">
        {searchParams.msg && (
          <p role="status" className="card p-3 text-center text-sm text-leaf">
            {searchParams.msg === "submitted" ? "Listing submitted. You'll be notified once a moderator approves it." : searchParams.msg.slice(0, 100)}
          </p>
        )}
        <nav className="flex gap-2" aria-label="Sections">
          <Link href="/marketplace/mine" className={`chip px-4 ${tab === "listings" ? "chip-on" : ""}`} aria-current={tab === "listings" ? "page" : undefined}>My listings</Link>
          <Link href="/marketplace/mine?tab=tx" className={`chip px-4 ${tab === "tx" ? "chip-on" : ""}`} aria-current={tab === "tx" ? "page" : undefined}>Transactions</Link>
        </nav>
        {tab === "listings" ? (
          <ul className="stagger-slow flex flex-col gap-2">
            {mine.map((l) => {
              const s = l.active ? STATUS[l.status] : { label: "Closed", tone: "text-mute" };
              return (
                <li key={l.id}>
                  <Link href={`/marketplace/${l.id}`} className="card flex items-center gap-3 p-3 hover:border-leaf">
                    <div className="w-14 shrink-0"><ItemArt emoji={l.emoji} src={l.imageUrl} size="h-14" text="text-2xl" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className={`text-xs ${s.tone}`}>{s.label}{l.moderationNote && l.status !== "APPROVED" ? ` · ${l.moderationNote}` : ""}</p>
                    </div>
                    <span className="text-xs text-mute">{l.pricePoints ? `${l.pricePoints} EC` : "Free"}</span>
                  </Link>
                </li>
              );
            })}
            {mine.length === 0 && (
              <li className="card p-6 text-center text-sm text-mute">
                Nothing listed yet. <Link href="/marketplace/new" className="text-leaf underline">Donate, sell or swap an item</Link>
              </li>
            )}
          </ul>
        ) : (
          <ul className="stagger-slow flex flex-col gap-2">
            {purchases.map((p) => {
              const bought = p.userId === user.id;
              return (
                <li key={p.id} className="card flex items-center gap-3 p-3">
                  <span className="text-2xl" aria-hidden>{item.get(p.listingId)?.emoji ?? "📦"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.get(p.listingId)?.title ?? "Removed item"}</p>
                    <p className="text-xs text-mute">{bought ? "You got this" : `Claimed by ${names.get(p.userId)?.name ?? "a member"}`} · {timeAgo(new Date(p.createdAt))}</p>
                  </div>
                  <span className={`text-sm font-medium ${bought ? "text-white/80" : "text-leaf"}`}>{p.points ? `${bought ? "−" : "+"}${p.points} EC` : "Free"}</span>
                </li>
              );
            })}
            {purchases.length === 0 && <li className="card p-6 text-center text-sm text-mute">No transactions yet.</li>}
          </ul>
        )}
      </div>
    </>
  );
}
