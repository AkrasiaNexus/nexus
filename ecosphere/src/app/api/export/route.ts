import { audit, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { peopleScope, scanScope } from "@/lib/queries";

const TYPES = ["scans", "food", "health", "users"] as const;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const type = TYPES.find((t) => t === new URL(req.url).searchParams.get("type")) ?? "scans";
  const scope = scanScope(user);
  const people = peopleScope(user);

  const rows: Record<string, unknown>[] =
    type === "scans" ? (await db.scan.findMany({ where: scope, include: { user: true }, orderBy: { createdAt: "desc" } }))
      .map((s) => ({ date: s.createdAt, memberId: s.user.memberId, class: s.user.grade, item: s.label, type: s.wasteType, kg: s.weightKg, aiConfidence: s.confidence.toFixed(2), points: s.points }))
    : type === "food" ? (await db.foodLog.findMany({ where: { user: people }, include: { user: true }, orderBy: { createdAt: "desc" } }))
      .map((f) => ({ date: f.createdAt, memberId: f.user.memberId, item: f.item, category: f.category, kg: f.kg, reason: f.reason, disposal: f.disposal }))
    : type === "health" ? (await db.healthReport.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId ?? "", ...(user.role === "TEACHER" && { className: user.grade ?? "" }) }, orderBy: { createdAt: "desc" } }))
      .map((h) => ({ date: h.createdAt, class: h.className, air: h.airQuality, tempC: h.temperatureC, hygiene: h.hygiene, cleaning: h.cleaning, bins: h.wasteLevel, present: h.present, total: h.total, incident: h.incident }))
    : (await db.user.findMany({ where: people, include: { school: true } }))
      .map((u) => ({ memberId: u.memberId, name: u.name, role: u.role, school: u.school?.name, class: u.grade, points: u.points, active: u.active, joined: u.createdAt }));

  await audit(user.id, "EXPORT", type);
  return new Response(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ecosphere-${type}.csv"` },
  });
}
