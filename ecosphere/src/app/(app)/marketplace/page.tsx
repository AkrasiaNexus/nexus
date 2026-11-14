import Link from "next/link";
import { Plus, Search, ShoppingCart, Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ItemArt } from "@/components/ItemArt";
import { Header } from "@/components/ui";

const CATS = ["All", "Reuse", "Donate", "Others"];

export default async function Marketplace({ searchParams }: { searchParams: { c?: string; q?: string } }) {
  const user = await requireUser();
  const cat = CATS.includes(searchParams.c ?? "") ? searchParams.c! : "All";
  const q = (searchParams.q ?? "").slice(0, 60);
  const where: Prisma.ListingWhereInput = {
    active: true,
    ...(cat !== "All" && { category: cat }),
    ...(q && { title: { contains: q, mode: "insensitive" } }),
  };
  const items = await db.listing.findMany({ where, orderBy: [{ ownerId: { sort: "asc", nulls: "first" } }, { id: "asc" }] });
  return (
    <>
      <Header title="Marketplace" back={null} right={
        <div className="flex items-center gap-1">
          <Link href="/marketplace/new" aria-label="Sell, donate or swap an item" className="rounded-full p-2 hover:bg-card"><Plus size={22} /></Link>
          <Link href="/history?t=Marketplace" aria-label="My purchases" className="rounded-full p-2 hover:bg-card"><ShoppingCart size={22} /></Link>
        </div>
      } />
      <div className="flex flex-col gap-4 px-5">
        <form className="relative" role="search">
          <Search size={18} className="absolute left-4 top-3.5 text-white/50" />
          <input name="q" defaultValue={q} placeholder="Search items..." className="input rounded-full pl-11" aria-label="Search items" />
          {cat !== "All" && <input type="hidden" name="c" value={cat} />}
        </form>
        <nav className="flex justify-between gap-2">
          {CATS.map((c) => (
            <Link key={c} href={`/marketplace?c=${c}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip px-4 ${c === cat ? "chip-on" : ""}`}>{c}</Link>
          ))}
        </nav>
        <p className="text-center text-xs text-white/50">You have <b className="text-leaf">{user.points} pts</b> to spend</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <Link key={it.id} href={`/marketplace/${it.id}`} className="card flex flex-col gap-2 p-3 hover:border-leaf">
              <ItemArt emoji={it.emoji} />
              <h2 className="text-sm font-medium leading-tight">{it.title}</h2>
              <p className="mt-auto flex items-center gap-1 text-sm text-leaf">
                <Star size={14} fill="currentColor" />{it.pricePoints ? `${it.pricePoints} pts` : it.kind === "EXCHANGE" ? "Swap" : "Free"}
              </p>
            </Link>
          ))}
          {items.length === 0 && <p className="col-span-2 text-center text-sm text-white/50">No items found.</p>}
        </div>
      </div>
    </>
  );
}
