import { Activity, Database, Download, Lock, ScanLine, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header, IconCircle } from "@/components/ui";
import { setSignupsOpen } from "../../../actions";

export default async function SystemSettings() {
  await requireUser(["SUPER_ADMIN"]);
  const day = new Date(Date.now() - 86_400_000);
  const started = Date.now();
  const [users, active, scans24, logins24, fails24, setting] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { active: true } }),
    db.scan.count({ where: { createdAt: { gte: day } } }),
    db.auditLog.count({ where: { action: "LOGIN", createdAt: { gte: day } } }),
    db.auditLog.count({ where: { action: "LOGIN_FAIL", createdAt: { gte: day } } }),
    db.setting.findUnique({ where: { key: "signupsOpen" } }),
  ]);
  const dbMs = Date.now() - started;
  const open = setting?.value !== "false";
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
      <div className="flex flex-col gap-4 px-5">
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
        <section className="card flex items-center gap-3 p-4">
          <div className="flex-1"><p className="text-sm font-medium">New sign-ups</p><p className="text-xs text-white/55">{open ? "Anyone can create an account." : "Paused: only existing users can log in."}</p></div>
          <form action={setSignupsOpen.bind(null, !open)}><button className={`chip ${open ? "chip-on" : ""}`} aria-pressed={open}>{open ? "Open" : "Paused"}</button></form>
        </section>
        <Link href="/admin/export" className="btn-ghost"><Download size={16} />Export platform data</Link>
      </div>
    </>
  );
}
