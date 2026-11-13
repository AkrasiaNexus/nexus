export type HealthInput = {
  airQuality: string; temperatureC: number; hygiene: number; cleaning: string;
  wasteLevel: string; present: number; total: number; incident: string;
};

export const ATTENDANCE_ALERT_PCT = 80;
export const MAX_COMFORT_TEMP_C = 30;

// Returns human-readable alerts; empty array = classroom OK.
export function healthAlerts(r: HealthInput): string[] {
  const alerts: string[] = [];
  if (r.airQuality === "POOR") alerts.push("Poor air quality: open windows / check ventilation");
  if (r.temperatureC > MAX_COMFORT_TEMP_C) alerts.push(`High temperature (${r.temperatureC}°C)`);
  if (r.hygiene <= 2) alerts.push(`Low hygiene score (${r.hygiene}/5)`);
  if (r.cleaning === "NEEDS_CLEANING") alerts.push("Classroom needs cleaning");
  if (r.wasteLevel === "FULL") alerts.push("Waste bins full: request pickup");
  if (r.total > 0 && (r.present / r.total) * 100 < ATTENDANCE_ALERT_PCT) alerts.push(`Low attendance (${r.present}/${r.total})`);
  if (r.incident.trim()) alerts.push(`Incident: ${r.incident.trim()}`);
  return alerts;
}

export const healthStatus = (alerts: string[]) => (alerts.length === 0 ? "OK" : alerts.length <= 2 ? "WATCH" : "ACTION");
