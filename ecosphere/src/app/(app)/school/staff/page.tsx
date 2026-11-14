import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { ResetButton } from "@/components/ResetButton";
import { toggleStaffActive } from "../../../actions";

export default async function ManageStaff() {
  const admin = await requireUser(["SCHOOL_ADMIN"]);
  const staff = await db.user.findMany({ where: { schoolId: admin.schoolId, role: { in: ["TEACHER", "HEALTH_MONITOR"] } }, orderBy: { name: "asc" } });
  return (
    <>
      <Header title="Manage Staff" back="/profile" />
      <div className="flex flex-col gap-3 px-5">
        <ul className="card overflow-hidden">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
              <span className="text-2xl">{s.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className={s.active ? "text-sm" : "text-sm text-white/50 line-through"}>{s.name}</p>
                <p className="truncate text-[11px] text-white/55">{s.role === "TEACHER" ? "Teacher" : "Health Monitor"} · {s.grade} · {s.memberId}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <form action={toggleStaffActive.bind(null, s.id)}><button className={`chip ${s.active ? "" : "chip-on"}`}>{s.active ? "Disable" : "Enable"}</button></form>
                <ResetButton userId={s.id} />
              </div>
            </li>
          ))}
          {staff.length === 0 && <li className="p-6 text-center text-sm text-white/55">No staff yet.</li>}
        </ul>
        <p className="text-center text-xs text-white/45">Staff join with the school&apos;s staff code (STAFF_SIGNUP_CODE). Share it only with your team.</p>
      </div>
    </>
  );
}
