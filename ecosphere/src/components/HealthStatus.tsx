import type { HealthReport } from "@prisma/client";
import { healthAlerts, healthStatus } from "@/lib/health";
import { timeAgo } from "./ui";

const STYLE = { OK: "text-leaf", WATCH: "text-yellow-300", ACTION: "text-red-400" };

export function HealthStatus({ report }: { report: HealthReport | null }) {
  if (!report) return <p className="text-sm text-mute">No health report yet.</p>;
  const alerts = healthAlerts(report);
  const status = healthStatus(alerts);
  return (
    <div className="space-y-2 text-sm">
      <p className={`font-semibold ${STYLE[status]}`}>{report.className}: {status === "OK" ? "All clear" : status === "WATCH" ? "Needs attention" : "Action required"} <span className="text-xs font-normal text-mute">· {timeAgo(report.createdAt)}</span></p>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-lg bg-panel p-2">Air<br /><b>{report.airQuality}</b></span>
        <span className="rounded-lg bg-panel p-2">Temp<br /><b>{report.temperatureC}°C</b></span>
        <span className="rounded-lg bg-panel p-2">Hygiene<br /><b>{report.hygiene}/5</b></span>
        <span className="rounded-lg bg-panel p-2">Cleaning<br /><b>{report.cleaning.replace("_", " ")}</b></span>
        <span className="rounded-lg bg-panel p-2">Bins<br /><b>{report.wasteLevel}</b></span>
        <span className="rounded-lg bg-panel p-2">Attendance<br /><b>{report.present}/{report.total}</b></span>
      </div>
      {alerts.length > 0 && <ul className="list-disc pl-5 text-xs text-yellow-200">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>}
    </div>
  );
}
