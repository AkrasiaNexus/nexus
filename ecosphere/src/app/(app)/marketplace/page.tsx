import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { RedeemButton } from "./RedeemButton";

const CATS = ["All", "Reuse", "Donate", "Others"];

export default async function Marketplace({ searchParams }: { searchParams: { c?: string; q?: string } }) {
  const user = await requireUser();
  const cat = CATS.includes(searchParams.c ?? "") ? searchParams.c! : "All";
  const q = (searchParams.q ?? "").slice(0, 60);
  const items = await db.listing.findMany({
    where: { ...(cat !== "All" && { category: cat }), ...(q && { title: { contains: q, mode: "insensitive" } }) },
    orderBy: { pricePoints: "asc" },
  });
  return (
    <>
      <Header title="Marketplace" back={null} right={<span className="chip chip-on">🌿 {user.points} pts</span>} />
      <div className="flex flex-col gap-4 px-5">
        <form className="relative" role="search">
          <Search size={16} className="absolute left-3 top-3.5 text-mute" />
          <input name="q" defaultValue={q} placeholder="Search items…" className="input pl-9" aria-label="Search items" />
          {cat !== "All" && <input type="hidden" name="c" value={cat} />}
        </form>
        <nav className="flex gap-2">
          {CATS.map((c) => (
            <Link key={c} href={`/marketplace?c=${c}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip ${c === cat ? "chip-on" : ""}`}>{c}</Link>
          ))}
        </nav>
        <p className="text-xs text-mute">Swap your green points for reusable, donated and upcycled goods to keep items in the loop.</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <article key={it.id} className="card flex flex-col gap-2 p-3">
              <div className="grid h-24 place-items-center rounded-xl bg-panel text-5xl">{it.emoji}</div>
              <h2 className="text-sm font-medium leading-tight">{it.title}</h2>
              <p className="text-[11px] text-mute">{it.description}</p>
              <p className="mt-auto text-sm text-leaf">★ {it.pricePoints} pts <span className="text-[11px] text-mute">· {it.stock} left</span></p>
              <RedeemButton id={it.id} disabled={it.stock < 1 || user.points < it.pricePoints} />
            </article>
          ))}
          {items.length === 0 && <p className="col-span-2 text-center text-sm text-mute">No items found.</p>}
        </div>
      </div>
    </>
  );
}
