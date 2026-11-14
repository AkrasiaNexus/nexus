import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ItemArt } from "@/components/ItemArt";
import { Header } from "@/components/ui";
import { closeListing } from "../../../feature-actions";
import { RedeemButton } from "../RedeemButton";

const KIND: Record<string, string> = { REWARD: "Eco reward", SELL: "Second-hand", DONATE: "Free · donated", EXCHANGE: "Swap" };

export default async function Item({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const it = await db.listing.findUnique({ where: { id: params.id }, include: { owner: { select: { name: true } } } });
  if (!it || !it.active) notFound();
  const mine = it.ownerId === user.id;
  return (
    <>
      <Header title={it.title} back="/marketplace" />
      <div className="flex flex-col gap-4 px-5">
        <ItemArt emoji={it.emoji} size="h-64" text="text-9xl" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{it.title}</h2>
            <p className="text-sm text-white/60">{KIND[it.kind]} · {it.category}{it.owner && ` · by ${it.owner.name}`}</p>
          </div>
          <p className="flex shrink-0 items-center gap-1 text-lg font-semibold text-leaf"><Star size={16} fill="currentColor" />{it.pricePoints ? `${it.pricePoints} pts` : "Free"}</p>
        </div>
        <p className="card p-4 text-sm text-white/75">{it.description}</p>
        {!it.ownerId && <p className="text-xs text-white/50">{it.stock} left · you have {user.points} pts</p>}
        {it.ownerId && !mine && <p className="text-xs text-white/50">Hand-over happens at school or in a public place. The owner is notified when you claim it.</p>}
        {mine
          ? <form action={closeListing.bind(null, it.id)}><button className="btn-ghost w-full">Remove my listing</button></form>
          : <RedeemButton id={it.id} label={it.kind === "REWARD" ? "Redeem" : it.kind === "SELL" ? "Buy" : "Claim"} disabled={it.stock < 1 || user.points < it.pricePoints} />}
      </div>
    </>
  );
}
