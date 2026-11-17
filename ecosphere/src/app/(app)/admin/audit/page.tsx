import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicNames, withDates } from "@/lib/queries";
import { Header, timeAgo } from "@/components/ui";

export default async function AuditLogs() {
  await requireUser(["SUPER_ADMIN"]);
  const rows = withDates((await createClient().from("audit_logs").select("*").order("createdAt", { ascending: false }).limit(100)).data, "createdAt");
  const actors = await publicNames(rows.map((l) => l.actorId));
  const logs = rows.map((l) => ({ ...l, actor: actors.get(l.actorId) ?? null }));
  return (
    <>
      <Header title="Audit Logs" back="/profile" />
      <ul className="card mx-5 overflow-hidden">
        {logs.map((l) => (
          <li key={l.id} className="flex gap-3 border-b border-line p-3 text-xs last:border-0">
            <span className={`w-28 shrink-0 font-mono ${l.action.includes("FAIL") || l.action.includes("DISABLED") ? "text-red-300" : "text-leaf"}`}>{l.action}</span>
            <span className="flex-1 truncate">{l.actor?.name ?? "anonymous"}{l.detail && <span className="text-mute"> · {l.detail}</span>}</span>
            <span className="text-mute">{timeAgo(l.createdAt)}</span>
          </li>
        ))}
        {logs.length === 0 && <li className="p-6 text-center text-sm text-mute">No events yet.</li>}
      </ul>
    </>
  );
}
