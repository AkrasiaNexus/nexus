import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { healthAlerts } from "@/lib/health";
import { ActionForm } from "@/components/ActionForm";
import { HealthStatus } from "@/components/HealthStatus";
import { Header, timeAgo } from "@/components/ui";
import { submitHealthReport } from "../../feature-actions";

const sel = (name: string, opts: string[], def?: string) => (
  <select name={name} aria-label={name} defaultValue={def} className="input">{opts.map((o) => <option key={o} value={o}>{o.replace("_", " ").toLowerCase()}</option>)}</select>
);

export default async function Health() {
  const user = await requireUser(["HEALTH_MONITOR", "TEACHER", "SCHOOL_ADMIN", "STUDENT", "PARENT"]);
  // Which (school, class) pairs this user may see.
  const classes = user.role === "PARENT"
    ? (await db.user.findMany({ where: { parentId: user.id }, select: { schoolId: true, grade: true } })).map((c) => ({ schoolId: c.schoolId ?? "", className: c.grade ?? "" }))
    : user.role === "SCHOOL_ADMIN"
      ? (await db.user.groupBy({ by: ["grade"], where: { schoolId: user.schoolId, role: "STUDENT" } })).map((g) => ({ schoolId: user.schoolId ?? "", className: g.grade ?? "" }))
      : [{ schoolId: user.schoolId ?? "", className: user.grade ?? "" }];
  const latest = await Promise.all(classes.map((c) => db.healthReport.findFirst({ where: c, orderBy: { createdAt: "desc" } })));
  const history = await db.healthReport.findMany({ where: { OR: classes }, orderBy: { createdAt: "desc" }, take: 15 });
  const canReport = ["HEALTH_MONITOR", "TEACHER", "SCHOOL_ADMIN"].includes(user.role);

  return (
    <>
      <Header title="Health & Safety" />
      <div className="flex flex-col gap-4 px-5">
        {classes.map((c, i) => <section key={c.className + i} className="card p-4"><HealthStatus report={latest[i]} />{!latest[i] && <p className="text-xs text-mute">{c.className}</p>}</section>)}

        {canReport && (
          <ActionForm action={submitHealthReport} submit="Submit daily report">
            <h2 className="text-sm font-medium">Daily classroom check</h2>
            {user.role === "SCHOOL_ADMIN"
              ? sel("className", classes.map((c) => c.className))
              : <input type="hidden" name="className" value={user.grade ?? ""} />}
            <div className="grid grid-cols-2 gap-2 text-xs text-mute">
              <label>Air quality{sel("airQuality", ["GOOD", "MODERATE", "POOR"])}</label>
              <label>Temperature °C<input name="temperatureC" type="number" step="0.5" defaultValue="24" className="input" /></label>
              <label>Hygiene (1-5)<input name="hygiene" type="number" min="1" max="5" defaultValue="4" className="input" /></label>
              <label>Cleaning{sel("cleaning", ["CLEAN", "IN_PROGRESS", "NEEDS_CLEANING"])}</label>
              <label>Waste bins{sel("wasteLevel", ["LOW", "MEDIUM", "FULL"])}</label>
              <label>Present / total<span className="flex gap-1"><input name="present" type="number" min="0" defaultValue="28" className="input" /><input name="total" type="number" min="1" defaultValue="30" className="input" /></span></label>
            </div>
            <textarea name="incident" maxLength={280} rows={2} placeholder="Incident report (optional): injuries, spills, hazards…" aria-label="Incident" className="input" />
            <p className="text-[11px] text-mute">Alerts are sent automatically to the class, their parents and the school admin.</p>
          </ActionForm>
        )}

        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-sm font-medium">Recent reports & incidents</h2>
          <ul>
            {history.map((h) => { const a = healthAlerts(h); return (
              <li key={h.id} className="border-b border-line px-4 py-3 text-xs last:border-0">
                <div className="flex justify-between"><span>{h.className} · {h.present}/{h.total} present</span><span className="text-mute">{timeAgo(h.createdAt)}</span></div>
                <p className={a.length ? "text-yellow-200" : "text-leaf"}>{a.length ? a.join(" · ") : "All clear"}</p>
              </li>
            ); })}
            {history.length === 0 && <li className="px-4 py-3 text-sm text-mute">No reports yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
