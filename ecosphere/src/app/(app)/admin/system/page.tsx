import { Activity, Database, Download, Lock, ScanLine, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header, IconCircle } from "@/components/ui";
import { setSignupsOpen } from "../../../actions";
import { setSetting } from "../../../admin-actions";

export default async function SystemSettings() {
  await requireUser(["SUPER_ADMIN"]);
  const day = new Date(Date.now() - 86_400_000);
  const started = Date.now();
  const sb = createClient();
  const n = (r: { count: number | null }) => r.count ?? 0;
  const since = day.toISOString();
  const [usersR, activeR, scansR, loginsR, failsR, settingR] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("scans").select("id", { count: "exact", head: true }).gte("createdAt", since),
    sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "LOGIN").gte("createdAt", since),
    sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "LOGIN_FAIL").gte("createdAt", since),
    sb.from("settings").select("key, value").in("key", ["signupsOpen", "marketplace.requireApproval"]),
  ]);
  const [users, active, scans24, logins24, fails24] = [n(usersR), n(activeR), n(scansR), n(loginsR), n(failsR)];
  const setting = (k: string) => settingR.data?.find((s) => s.key === k)?.value;
  const dbMs = Date.now() - started;
  const open = setting("signupsOpen") !== "false";
  const approval = setting("marketplace.requireApproval") !== "false";
  const checks = [
    { icon: <Database size={20} />, label: "Database", value: `Online · ${dbMs} ms`, ok: true },
    { icon: <Users size={20} />, label: "Accounts", value: `${active} active / ${users} total`, ok: true },
    { icon: <ScanLine size={20} />, label: "Scans (24h)", value: String(scans24), ok: true },
    { icon: <Activity size={20} />, label: "Logins (24h)", value: String(logins24), ok: true },
    { icon: <ShieldAlert size={20} />, label: "Failed logins (24h)", value: String(fails24), ok: fails24 < 20 },
    { icon: <Lock size={20} />, label: "Admin 2nd factor", value: process.env.ADMIN_LOGIN_CODE ? "On" : "Off (set ADMIN_LOGIN_CODE)", ok: !!process.env.ADMIN_LOGIN_CODE },
  ];
  return (
    <>
      <Header title="System Settings" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-sm font-medium">System monitoring</h2>
          <ul>
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
                <IconCircle size={36} tone={c.ok ? "green" : "orange"}>{c.icon}</IconCircle>
                <span className="flex-1">{c.label}</span><span className={c.ok ? "text-white/70" : "text-orange-300"}>{c.value}</span>
              </li>
            ))}
          </ul>
        </section>
        <h2 className="-mb-2 px-1 text-xs uppercase tracking-wide text-mute">Access</h2>
        <section className="card flex items-center gap-3 p-4">
          <div className="flex-1"><p className="text-sm font-medium">New sign-ups</p><p className="text-xs text-white/55">{open ? "Anyone can create an account." : "Paused: only existing users can log in."}</p></div>
          <form action={setSignupsOpen.bind(null, !open)}><button className={`chip ${open ? "chip-on" : ""}`} aria-pressed={open}>{open ? "Open" : "Paused"}</button></form>
        </section>
        <h2 className="-mb-2 px-1 text-xs uppercase tracking-wide text-mute">Marketplace</h2>
        <section className="card flex items-center gap-3 p-4">
          <div className="flex-1"><p className="text-sm font-medium">Approve new listings</p><p className="text-xs text-white/55">{approval ? "New listings wait in the moderation queue." : "New listings go live immediately (reports still work)."}</p></div>
          <form action={setSetting.bind(null, "marketplace.requireApproval", String(!approval))}><button className={`chip ${approval ? "chip-on" : ""}`} aria-pressed={approval}>{approval ? "On" : "Off"}</button></form>
        </section>
        <h2 className="-mb-2 px-1 text-xs uppercase tracking-wide text-mute">AI scanner</h2>
        <section className="card p-4 text-sm">
          <p className="font-medium">{process.env.CLASSIFIER_URL ? "Server classifier configured" : "On-device model only"}</p>
          <p className="text-xs text-white/55">{process.env.CLASSIFIER_URL ? "Photos go to the hosted classifier first, on-device AI is the fallback." : "Set CLASSIFIER_URL (and CLASSIFIER_API_KEY) on the server to add a hosted model."}</p>
        </section>
        <h2 className="-mb-2 px-1 text-xs uppercase tracking-wide text-mute">Data</h2>
        <Link href="/admin/export" className="btn-ghost"><Download size={16} />Export platform data</Link>
      </div>
    </>
  );
}
