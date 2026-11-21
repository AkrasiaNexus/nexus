import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicNames } from "@/lib/queries";
import { ItemArt } from "@/components/ItemArt";
import { Header } from "@/components/ui";
import { RedeemButton } from "../RedeemButton";
import { ActionForm } from "@/components/ActionForm";
import { CONDITION_LABEL } from "@/lib/listing";
import { closeListing, reportListing } from "../../../feature-actions";

const KIND: Record<string, string> = { REWARD: "Eco reward", SELL: "Second-hand", DONATE: "Free · donated", EXCHANGE: "Swap" };

export default async function Item({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const { data: row } = await createClient().from("listings").select("*").eq("id", params.id).maybeSingle();
  if (!row || !row.active) notFound();
  const it = { ...row, owner: row.ownerId ? (await publicNames([row.ownerId])).get(row.ownerId) ?? null : null };
  const mine = it.ownerId === user.id;
  return (
    <>
      <Header title={it.title} back="/marketplace" />
      <div className="stagger flex flex-col gap-4 px-5">
        <div className="blur-in"><ItemArt emoji={it.emoji} src={it.imageUrl} alt={it.title} size="h-64" /></div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{it.title}</h2>
            <p className="text-sm text-white/60">{KIND[it.kind]} · {it.category}{it.ownerId && ` · ${CONDITION_LABEL[it.condition]}`}{it.owner && ` · by ${it.owner.name}`}</p>
          </div>
          <p className="flex shrink-0 items-center gap-1 text-lg font-semibold text-leaf"><Star size={16} fill="currentColor" />{it.pricePoints ? `${it.pricePoints} EC` : "Free"}</p>
        </div>
        {mine && it.status !== "APPROVED" && (
          <p role="status" className="card p-3 text-sm text-gold">
            {it.status === "PENDING" ? "Waiting for moderator approval. Only you can see it for now." : `Not published${it.moderationNote ? `: ${it.moderationNote}` : "."}`}
          </p>
        )}
        <p className="card p-4 text-sm text-white/75">{it.description}</p>
        {!it.ownerId && <p className="text-xs text-white/50">{it.stock} left · you have {user.points} EC</p>}
        {it.ownerId && !mine && <p className="text-xs text-white/50">Hand-over happens at school or in a public place. The owner is notified when you claim it.</p>}
        {mine
          ? <form action={closeListing.bind(null, it.id)}><button className="btn-ghost w-full">Remove my listing</button></form>
          : <RedeemButton id={it.id} label={it.kind === "REWARD" ? "Redeem" : it.kind === "SELL" ? "Buy" : "Claim"} disabled={it.stock < 1 || user.points < it.pricePoints} />}
        {it.ownerId && !mine && (
          <details className="text-sm">
            <summary className="cursor-pointer text-center text-xs text-mute hover:text-white">Report this listing</summary>
            <ActionForm action={reportListing.bind(null, it.id)} submit="Send report" className="mt-2">
              <textarea name="reason" required minLength={3} maxLength={280} rows={2} placeholder="What's wrong? (unsafe, fake, offensive…)" aria-label="Reason for report" className="input" />
            </ActionForm>
          </details>
        )}
      </div>
    </>
  );
}
