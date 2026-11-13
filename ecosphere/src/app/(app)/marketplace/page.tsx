import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { closeListing } from "../../feature-actions";
import { RedeemButton } from "./RedeemButton";

const CATS = ["All", "Reuse", "Donate", "Community", "Others"];
const KIND = { REWARD: "Reward", SELL: "Second-hand", DONATE: "Free · donated", EXCHANGE: "Swap" } as Record<string, string>;

export default async function Marketplace({ searchParams }: { searchParams: { c?: string; q?: string } }) {
  const user = await requireUser();
  const cat = CATS.includes(searchParams.c ?? "") ? searchParams.c! : "All";
  const q = (searchParams.q ?? "").slice(0, 60);
  const where: Prisma.ListingWhereInput = {
    active: true,
    ...(cat === "Community" ? { ownerId: { not: null } } : cat !== "All" && { category: cat }),
    ...(q && { title: { contains: q, mode: "insensitive" } }),
  };
  const [items, mine] = await Promise.all([
    db.listing.findMany({ where, include: { owner: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }] }),
    db.listing.findMany({ where: { ownerId: user.id, active: true } }),
  ]);
  return (
    <>
      <Header title="Marketplace" back={null} right={<span className="chip chip-on">🌿 {user.points} pts</span>} />
      <div className="flex flex-col gap-4 px-5">
        <form className="relative" role="search">
          <Search size={16} className="absolute left-3 top-3.5 text-mute" />
          <input name="q" defaultValue={q} placeholder="Search items…" className="input pl-9" aria-label="Search items" />
          {cat !== "All" && <input type="hidden" name="c" value={cat} />}
        </form>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <Link key={c} href={`/marketplace?c=${c}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip shrink-0 ${c === cat ? "chip-on" : ""}`}>{c}</Link>
          ))}
        </nav>
        <Link href="/marketplace/new" className="btn-ghost py-2 text-sm"><Plus size={16} />Sell, donate or swap an item</Link>
        <p className="text-xs text-mute">Buy second-hand, donate or swap with green points to keep items in the loop instead of the bin.</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <article key={it.id} className="card flex flex-col gap-2 p-3">
              <div className="relative grid h-24 place-items-center rounded-xl bg-panel text-5xl">{it.emoji}
                <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-2 text-[10px] text-leaf">{KIND[it.kind]}</span>
              </div>
              <h2 className="text-sm font-medium leading-tight">{it.title}</h2>
              <p className="text-[11px] text-mute">{it.description}</p>
              {it.owner && <p className="text-[11px] text-mute">by {it.owner.name}</p>}
              <p className="mt-auto text-sm text-leaf">{it.pricePoints ? `★ ${it.pricePoints} pts` : "Free"} {!it.ownerId && <span className="text-[11px] text-mute">· {it.stock} left</span>}</p>
              {it.ownerId === user.id
                ? <form action={closeListing.bind(null, it.id)}><button className="btn-ghost w-full py-2 text-xs">Remove</button></form>
                : <RedeemButton id={it.id} label={it.kind === "REWARD" ? "Redeem" : it.kind === "SELL" ? "Buy" : "Claim"} disabled={it.stock < 1 || user.points < it.pricePoints} />}
            </article>
          ))}
          {items.length === 0 && <p className="col-span-2 text-center text-sm text-mute">No items found.</p>}
        </div>
        {mine.length > 0 && <p className="text-center text-xs text-mute">You have {mine.length} active listing(s).</p>}
      </div>
    </>
  );
}
