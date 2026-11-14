import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { healthAlerts, healthStatus } from "@/lib/health";
import { startOf } from "@/lib/queries";
import { impact } from "@/lib/waste";
import { Header } from "@/components/ui";

const DOT = { OK: "🟢", WATCH: "🟡", ACTION: "🔴" };

export default async function ManageClasses() {
  const admin = await requireUser(["SCHOOL_ADMIN"]);
  const people = await db.user.findMany({
    where: { schoolId: admin.schoolId, role: { in: ["STUDENT", "TEACHER", "HEALTH_MONITOR"] } },
    include: { scans: { where: { createdAt: { gte: startOf("month") } }, select: { wasteType: true, weightKg: true } } },
  });
  const grades = Array.from(new Set(people.map((p) => p.grade ?? "Unassigned"))).sort();
  const reports = await Promise.all(grades.map((g) => db.healthReport.findFirst({ where: { schoolId: admin.schoolId ?? "", className: g }, orderBy: { createdAt: "desc" } })));
  return (
    <>
      <Header title="Manage Classes" back="/profile" />
      <div className="flex flex-col gap-3 px-5">
        {grades.map((g, i) => {
          const students = people.filter((p) => p.role === "STUDENT" && (p.grade ?? "Unassigned") === g);
          const staff = people.filter((p) => p.role !== "STUDENT" && p.grade === g);
          const im = impact(students.flatMap((s) => s.scans));
          const r = reports[i];
          return (
            <article key={g} className="card space-y-2 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{g}</h2>
                <span className="text-sm">{r ? DOT[healthStatus(healthAlerts(r))] : "⚪"} {r ? r.cleaning.replace("_", " ").toLowerCase() : "no report"}</span>
              </div>
              <p className="text-xs text-white/60">{students.length} students · {im.kg} kg sorted this month · {im.recyclingRate}% recycled</p>
              <p className="text-xs text-white/60">Staff: {staff.map((s) => `${s.name} (${s.role === "TEACHER" ? "Teacher" : "Health Monitor"})`).join(", ") || "none assigned"}</p>
            </article>
          );
        })}
        {grades.length === 0 && <p className="card p-6 text-center text-sm text-white/55">No classes yet. Classes appear when students join.</p>}
        <p className="text-center text-xs text-white/45">Classes are created automatically from the class students and staff enter when they sign up.</p>
      </div>
    </>
  );
}
