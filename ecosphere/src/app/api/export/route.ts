import { audit, currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

const TYPES = ["scans", "health", "users"] as const;
type Embedded<T> = T | T[] | null;
const one = <T,>(v: Embedded<T>) => (Array.isArray(v) ? v[0] : v);

// Row-level security scopes every export to what the caller may see (class / school / platform).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const type = TYPES.find((t) => t === new URL(req.url).searchParams.get("type")) ?? "scans";
  const sb = createClient();

  let rows: Record<string, unknown>[];
  if (type === "scans") {
    const { data } = await sb.from("scans").select("*, user:profiles(memberId, grade)").order("createdAt", { ascending: false });
    rows = (data ?? []).map((s) => ({ date: s.createdAt, memberId: one(s.user)?.memberId, class: one(s.user)?.grade, item: s.label, type: s.wasteType, kg: s.weightKg, aiConfidence: Number(s.confidence).toFixed(2), points: s.points }));
  } else if (type === "health") {
    const { data } = await sb.from("health_reports").select("*").order("createdAt", { ascending: false });
    rows = (data ?? []).map((h) => ({ date: h.createdAt, class: h.className, air: h.airQuality, tempC: h.temperatureC, hygiene: h.hygiene, cleaning: h.cleaning, bins: h.wasteLevel, present: h.present, total: h.total, incident: h.incident }));
  } else {
    const { data } = await sb.from("profiles").select("*, school:schools(name)");
    rows = (data ?? []).map((u) => ({ memberId: u.memberId, name: u.name, role: u.role, school: one(u.school)?.name, class: u.grade, points: u.points, active: u.active, joined: u.createdAt }));
  }

  await audit(user.id, "EXPORT", type);
  return new Response(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ecosphere-${type}.csv"` },
  });
}
