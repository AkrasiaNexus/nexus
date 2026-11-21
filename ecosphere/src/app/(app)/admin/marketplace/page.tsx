import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { publicNames, withDates } from "@/lib/queries";
import { CONDITION_LABEL } from "@/lib/listing";
import { ActionForm } from "@/components/ActionForm";
import { ItemArt } from "@/components/ItemArt";
import { Header, timeAgo } from "@/components/ui";
import { dismissReport, moderateListing } from "../../../admin-actions";

type Listing = { id: string; title: string; description: string; emoji: string; imageUrl: string | null; kind: string; condition: string; pricePoints: number; ownerId: string; status: string; createdAt: string };

function Decide({ id, options }: { id: string; options: [string, string][] }) {
  return (
    <ActionForm action={moderateListing.bind(null, id)} submit="Apply" className="mt-2 border-0 bg-panel p-3">
      <div className="flex flex-wrap gap-3 text-sm">
        {options.map(([v, label], i) => (
          <label key={v} className="flex items-center gap-1.5"><input type="radio" name="decision" value={v} defaultChecked={i === 0} className="accent-[#a2d47e]" />{label}</label>
        ))}
      </div>
      <input name="note" maxLength={200} placeholder="Note to the owner (required to reject/remove)" aria-label="Note to the owner" className="input" />
    </ActionForm>
  );
}

export default async function Moderation({ searchParams }: { searchParams: { tab?: string } }) {
  await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const tab = searchParams.tab === "reports" ? "reports" : "queue";
  const [{ data: pending }, { data: reports }] = await Promise.all([
    db.from("listings").select("*").eq("status", "PENDING").eq("active", true).order("createdAt").limit(50),
    db.from("listing_reports").select("id, reason, createdAt, reporterId, listing:listings(id, title, emoji, imageUrl, status, ownerId)").eq("status", "OPEN").order("createdAt").limit(50),
  ]);
  const queue = withDates(pending as Listing[] | null, "createdAt");
  const open = withDates(reports as unknown as { id: string; reason: string; createdAt: string; reporterId: string | null; listing: { id: string; title: string; emoji: string; imageUrl: string | null; status: string; ownerId: string | null } }[] | null, "createdAt");
  const names = await publicNames([...queue.map((l) => l.ownerId), ...open.flatMap((r) => [r.reporterId, r.listing.ownerId])].filter(Boolean) as string[]);
  const tabLink = (t: string, label: string, n: number) => (
    <Link href={`/admin/marketplace${t === "queue" ? "" : "?tab=reports"}`} aria-current={tab === t ? "page" : undefined} className={`chip px-4 ${tab === t ? "chip-on" : ""}`}>{label}{n > 0 && ` · ${n}`}</Link>
  );
  return (
    <>
      <Header title="Marketplace moderation" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <nav className="flex gap-2">{tabLink("queue", "Approval queue", queue.length)}{tabLink("reports", "Reports", open.length)}</nav>
        {tab === "queue" ? (
          <ul className="stagger-slow flex flex-col gap-3">
            {queue.map((l) => (
              <li key={l.id} className="card p-4">
                <div className="flex gap-3">
                  <div className="w-20 shrink-0"><ItemArt emoji={l.emoji} src={l.imageUrl} alt={l.title} size="h-20" /></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{l.title}</p>
                    <p className="text-xs text-mute">{l.kind.toLowerCase()} · {CONDITION_LABEL[l.condition]} · {l.pricePoints ? `${l.pricePoints} EC` : "free"} · by {names.get(l.ownerId)?.name ?? "member"} · {timeAgo(l.createdAt)}</p>
                    <p className="mt-1 text-white/75">{l.description}</p>
                  </div>
                </div>
                <Decide id={l.id} options={[["APPROVED", "Approve"], ["REJECTED", "Reject"]]} />
              </li>
            ))}
            {queue.length === 0 && <li className="card p-6 text-center text-sm text-mute">Queue is empty. Nice.</li>}
          </ul>
        ) : (
          <ul className="stagger-slow flex flex-col gap-3">
            {open.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 shrink-0"><ItemArt emoji={r.listing.emoji} src={r.listing.imageUrl} size="h-14" /></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/marketplace/${r.listing.id}`} className="font-semibold hover:text-leaf">{r.listing.title}</Link>
                    <p className="text-xs text-mute">Reported by {r.reporterId ? names.get(r.reporterId)?.name ?? "member" : "deleted user"} · {timeAgo(r.createdAt)} · listing {r.listing.status.toLowerCase()}</p>
                  </div>
                  <form action={dismissReport.bind(null, r.id)}><button className="chip text-xs">Dismiss</button></form>
                </div>
                <p className="mt-2 rounded-lg bg-panel p-3 text-sm text-white/80">“{r.reason}”</p>
                {r.listing.status !== "REMOVED" && <Decide id={r.listing.id} options={[["REMOVED", "Remove listing"]]} />}
              </li>
            ))}
            {open.length === 0 && <li className="card p-6 text-center text-sm text-mute">No open reports.</li>}
          </ul>
        )}
      </div>
    </>
  );
}
