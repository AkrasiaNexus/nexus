import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { withDates } from "@/lib/queries";
import { PUBLIC_ROLES } from "@/lib/validation";
import { ActionForm } from "@/components/ActionForm";
import { ResetButton } from "@/components/ResetButton";
import { Header, timeAgo } from "@/components/ui";
import { toggleUserActive } from "../../../../actions";
import { adjustPoints, updateUser } from "../../../../admin-actions";

const roleLabel = (r: string) => r.replace("_", " ").toLowerCase();

export default async function UserDetail({ params }: { params: { id: string } }) {
  const me = await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const [{ data: u }, { data: schools }, { data: communities }, { data: ledger }, { count: scans }] = await Promise.all([
    db.from("profiles").select("*, school:schools(name)").eq("id", params.id).maybeSingle(),
    db.from("schools").select("id, name").order("name"),
    db.from("communities").select("id, name").order("name"),
    db.from("point_events").select("id, delta, reason, createdAt").eq("userId", params.id).order("createdAt", { ascending: false }).limit(10),
    db.from("scans").select("id", { count: "exact", head: true }).eq("userId", params.id),
  ]);
  if (!u) notFound();
  const editable = u.id !== me.id && u.role !== "SUPER_ADMIN";
  return (
    <>
      <Header title={u.name} back="/admin/users" />
      <div className="stagger flex flex-col gap-4 px-5">
        <section className="card flex items-center gap-4 p-4">
          <span className="text-4xl" aria-hidden>{u.avatar}</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{u.name} {!u.active && <span className="chip ml-1 text-[11px] text-gold">Suspended</span>}</p>
            <p className="truncate text-xs text-mute">{u.email} · <span className="font-mono">{u.memberId}</span></p>
            <p className="text-xs text-mute">{roleLabel(u.role)}{u.school ? ` · ${u.school.name}` : ""}{u.grade ? ` · ${u.grade}` : ""}{u.community ? ` · ${u.community}` : ""}</p>
          </div>
          <div className="text-right"><p className="text-lg font-semibold text-leaf">{u.points}</p><p className="text-[11px] text-mute">EC · {scans ?? 0} scans</p></div>
        </section>

        {editable ? (
          <>
            <ActionForm action={updateUser.bind(null, u.id)} submit="Save role & membership">
              <h2 className="font-semibold">Role & membership</h2>
              <select name="role" defaultValue={u.role} aria-label="Role" className="input">{PUBLIC_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
              <select name="schoolId" defaultValue={u.schoolId ?? ""} aria-label="School" className="input"><option value="">No school</option>{schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input name="grade" defaultValue={u.grade ?? ""} maxLength={30} placeholder="Class (e.g. Grade 7)" aria-label="Class" className="input" />
              <select name="communityId" defaultValue={u.communityId ?? ""} aria-label="Community" className="input"><option value="">No community</option>{communities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="department" defaultValue={u.department ?? ""} maxLength={60} placeholder="Department (employees)" aria-label="Department" className="input" />
              <p className="text-[11px] text-mute">To make someone a community admin, pick the role and their community here.</p>
            </ActionForm>
            <ActionForm action={adjustPoints.bind(null, u.id)} submit="Apply adjustment">
              <h2 className="font-semibold">Adjust points</h2>
              <div className="flex gap-2">
                <input name="delta" type="number" required min={-10000} max={10000} placeholder="+50 or -20" aria-label="Points change" className="input w-32" />
                <input name="reason" required minLength={3} maxLength={120} placeholder="Reason (shown to the user)" aria-label="Reason" className="input flex-1" />
              </div>
            </ActionForm>
            <section className="card flex items-center gap-3 p-4">
              <div className="flex-1 text-sm">
                <p className="font-medium">{u.active ? "Account active" : "Account suspended"}</p>
                <p className="text-xs text-mute">{u.active ? "Suspending signs them out and blocks login." : "Reactivating restores login."}</p>
              </div>
              <form action={toggleUserActive.bind(null, u.id)}><button className={`chip ${u.active ? "text-red-300" : "chip-on"}`}>{u.active ? "Suspend" : "Reactivate"}</button></form>
              <ResetButton userId={u.id} />
            </section>
          </>
        ) : (
          <p className="card p-4 text-sm text-mute">Super admin accounts (including yours) can&apos;t be edited here.</p>
        )}

        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 text-sm font-medium">Recent points</h2>
          <ul>
            {withDates(ledger, "createdAt").map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span className="flex-1 truncate">{e.reason}</span>
                <span className={e.delta > 0 ? "text-leaf" : "text-orange-300"}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
                <span className="w-16 text-right text-[11px] text-mute">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
            {!ledger?.length && <li className="p-4 text-center text-xs text-mute">No points activity.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
