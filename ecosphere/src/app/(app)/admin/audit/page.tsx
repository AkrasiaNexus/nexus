import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header, timeAgo } from "@/components/ui";

export default async function AuditLogs() {
  await requireUser(["SUPER_ADMIN"]);
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } });
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
