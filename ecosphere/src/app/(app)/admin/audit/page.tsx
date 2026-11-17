import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicNames, withDates } from "@/lib/queries";
import { Header, timeAgo } from "@/components/ui";

const RANGES = { "1": "24 hours", "7": "7 days", "30": "30 days", all: "All time" } as const;
const GROUPS: Record<string, string> = { "": "All actions", LOGIN: "Sign-ins", USER: "Users", LISTING: "Marketplace", POINTS: "Points", SETTING: "Settings", CHALLENGE: "Challenges", BROADCAST: "Broadcasts" };

export default async function AuditLogs({ searchParams: sp }: { searchParams: { q?: string; a?: string; d?: string } }) {
  await requireUser(["SUPER_ADMIN"]);
  const q = (sp.q ?? "").replace(/[%_,()\\]/g, "").slice(0, 60); // strip filter syntax characters
  const group = sp.a && sp.a in GROUPS ? sp.a : "";
  const range = sp.d && sp.d in RANGES ? sp.d : "7";
  let query = createClient().from("audit_logs").select("*").order("createdAt", { ascending: false }).limit(200);
  if (q) query = query.or(`action.ilike.%${q}%,detail.ilike.%${q}%`);
  if (group) query = query.ilike("action", `${group}%`);
  if (range !== "all") query = query.gte("createdAt", new Date(Date.now() - Number(range) * 86_400_000).toISOString());
  const rows = withDates((await query).data, "createdAt");
  const actors = await publicNames(rows.map((l) => l.actorId));
  const logs = rows.map((l) => ({ ...l, actor: actors.get(l.actorId) ?? null }));
  return (
    <>
      <Header title="Audit Logs" back="/profile" />
      <form role="search" className="card mx-5 mb-3 grid grid-cols-2 gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="Search action or detail" aria-label="Search audit log" className="input col-span-2" />
        <select name="a" defaultValue={group} aria-label="Action type" className="input">{Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="d" defaultValue={range} aria-label="Date range" className="input">{Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn col-span-2 py-2">Filter</button>
      </form>
      <p className="mx-5 mb-2 text-xs text-mute">{rows.length === 200 ? "Showing the latest 200 matches." : `${rows.length} event${rows.length === 1 ? "" : "s"}`} · append-only log</p>
      <ul className="card mx-5 overflow-hidden">
        {logs.map((l) => (
          <li key={l.id} className="flex gap-3 border-b border-line p-3 text-xs last:border-0">
            <span className={`w-28 shrink-0 font-mono ${l.action.includes("FAIL") || l.action.includes("DISABLED") ? "text-red-300" : "text-leaf"}`}>{l.action}</span>
            <span className="flex-1 truncate">{l.actor?.name ?? "anonymous"}{l.detail && <span className="text-mute"> · {l.detail}</span>}</span>
            <span className="text-mute">{timeAgo(l.createdAt)}</span>
          </li>
        ))}
        {logs.length === 0 && <li className="p-6 text-center text-sm text-mute">No events match.</li>}
      </ul>
    </>
  );
}
