import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_ROLES } from "@/lib/validation";
import { BroadcastForm } from "@/components/BroadcastForm";
import { Header } from "@/components/ui";
import { Critter } from "@/components/Critter";

const ROLES = [...PUBLIC_ROLES, "SUPER_ADMIN"] as const;
const roleLabel = (r: string) => r.replace("_", " ").toLowerCase();

type Search = { q?: string; role?: string; school?: string; community?: string; status?: string };

export default async function ManageUsers({ searchParams: sp }: { searchParams: Search }) {
  await requireUser(["SUPER_ADMIN"]);
  const sb = createClient();
  const q = (sp.q ?? "").slice(0, 60);
  const [{ data: schools }, { data: communities }] = await Promise.all([
    sb.from("schools").select("id, name").order("name"),
    sb.from("communities").select("id, name").order("name"),
  ]);
  let query = sb.from("profiles").select("id, name, email, role, avatar, active, memberId, school:schools(name)").order("createdAt", { ascending: false }).limit(100);
  if (q) {
    const like = `%${q.replace(/[%_,()\\]/g, "")}%`; // strip filter syntax characters from user input
    query = query.or(`name.ilike.${like},email.ilike.${like},memberId.ilike.${like}`);
  }
  if ((ROLES as readonly string[]).includes(sp.role ?? "")) query = query.eq("role", sp.role!);
  if (schools?.some((s) => s.id === sp.school)) query = query.eq("schoolId", sp.school!);
  if (communities?.some((c) => c.id === sp.community)) query = query.eq("communityId", sp.community!);
  if (sp.status === "active" || sp.status === "suspended") query = query.eq("active", sp.status === "active");
  const users = ((await query).data ?? []) as unknown as { id: string; name: string; email: string; role: string; avatar: string; active: boolean; memberId: string; school: { name: string } | null }[];
  const filtered = !!(q || sp.role || sp.school || sp.community || sp.status);
  return (
    <>
      <Header title="Manage Users" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <form role="search" className="card grid grid-cols-2 gap-2 p-3">
          <input name="q" defaultValue={q} placeholder="Name, email or EcoSphere ID" aria-label="Search users" className="input col-span-2" />
          <select name="role" defaultValue={sp.role ?? ""} aria-label="Role" className="input"><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input"><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended / pending</option></select>
          <select name="school" defaultValue={sp.school ?? ""} aria-label="School" className="input"><option value="">All schools</option>{schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select name="community" defaultValue={sp.community ?? ""} aria-label="Community" className="input"><option value="">All communities</option>{communities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="col-span-2 flex gap-2">
            <button className="btn flex-1 py-2">Filter</button>
            {filtered && <Link href="/admin/users" className="btn-ghost py-2">Clear</Link>}
          </div>
        </form>
        <p className="text-xs text-mute">{users.length === 100 ? "Showing the latest 100. Narrow with filters." : `${users.length} user${users.length === 1 ? "" : "s"}`}</p>
        <ul className="stagger-slow card overflow-hidden">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 border-b border-line p-3 text-sm hover:bg-panel">
                <Critter avatar={u.avatar} size={32} />
                <div className="min-w-0 flex-1">
                  <p className={u.active ? "" : "text-mute line-through"}>{u.name}</p>
                  <p className="truncate text-[11px] text-mute">{u.memberId} · {roleLabel(u.role)}{u.school ? ` · ${u.school.name}` : ""}</p>
                </div>
                {!u.active && <span className="chip text-[11px] text-gold">Suspended</span>}
                <ChevronRight size={16} className="text-mute" />
              </Link>
            </li>
          ))}
          {users.length === 0 && <li className="p-6 text-center text-sm text-mute">No users match these filters.</li>}
        </ul>
        <BroadcastForm audience="all users" />
      </div>
    </>
  );
}
