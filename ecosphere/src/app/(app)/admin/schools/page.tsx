import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { createSchool } from "../../../admin-actions";

export default async function Schools() {
  await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const [{ data: schools }, { data: members }] = await Promise.all([
    db.from("schools").select("id, name, city").order("name"),
    db.from("profiles").select("schoolId, role, active").not("schoolId", "is", null),
  ]);
  const count = (id: string, pred: (m: { role: string; active: boolean }) => boolean) => (members ?? []).filter((m) => m.schoolId === id && pred(m)).length;
  return (
    <>
      <Header title="Schools" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <ul className="stagger-slow card overflow-hidden">
          {schools?.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/users?school=${s.id}`} className="flex items-center gap-3 border-b border-line p-4 text-sm hover:bg-panel">
                <div className="flex-1"><p className="font-medium">{s.name}</p><p className="text-xs text-mute">{s.city}</p></div>
                <p className="text-right text-xs text-mute">
                  {count(s.id, (m) => m.role === "STUDENT")} students · {count(s.id, (m) => m.role !== "STUDENT")} staff
                  {count(s.id, (m) => m.role === "SCHOOL_ADMIN" && m.active) === 0 && <span className="block text-gold">No active school admin</span>}
                </p>
              </Link>
            </li>
          ))}
          {!schools?.length && <li className="p-6 text-center text-sm text-mute">No schools yet.</li>}
        </ul>
        <ActionForm action={createSchool} submit="Add school">
          <h2 className="font-semibold">Add a school</h2>
          <input name="name" required minLength={2} maxLength={80} placeholder="School name" aria-label="School name" className="input" />
          <input name="city" required minLength={2} maxLength={60} placeholder="City" aria-label="City" className="input" />
          <p className="text-[11px] text-mute">To appoint a school admin, open the user in Manage Users and set their role and school.</p>
        </ActionForm>
      </div>
    </>
  );
}
