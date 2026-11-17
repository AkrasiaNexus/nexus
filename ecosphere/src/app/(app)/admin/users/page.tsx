import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BroadcastForm } from "@/components/BroadcastForm";
import { ResetButton } from "@/components/ResetButton";
import { Header } from "@/components/ui";
import { toggleUserActive } from "../../../actions";

export default async function ManageUsers({ searchParams }: { searchParams: { q?: string } }) {
  const admin = await requireUser(["SUPER_ADMIN"]);
  const q = (searchParams.q ?? "").slice(0, 60);
  let query = createClient().from("profiles").select("*, school:schools(name)").order("createdAt", { ascending: false }).limit(100);
  if (q) {
    const like = `%${q.replace(/[%_,()\\]/g, "")}%`; // strip filter syntax characters from user input
    query = query.or(`name.ilike.${like},email.ilike.${like}`);
  }
  const users = (await query).data ?? [];
  return (
    <>
      <Header title="Manage Users" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <form role="search"><input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className="input" /></form>
        <ul className="card overflow-hidden">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 border-b border-line p-3 text-sm last:border-0">
              <span className="text-xl">{u.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className={u.active ? "" : "text-mute line-through"}>{u.name}</p>
                <p className="truncate text-[11px] text-mute">{u.email} · {u.role.replace("_", " ").toLowerCase()}{u.school ? ` · ${u.school.name}` : ""}</p>
              </div>
              {u.id !== admin.id && u.role !== "SUPER_ADMIN" && (
                <div className="flex flex-col items-end gap-1">
                  <form action={toggleUserActive.bind(null, u.id)}>
                    <button className={`chip ${u.active ? "" : "chip-on"}`}>{u.active ? "Disable" : "Enable"}</button>
                  </form>
                  <ResetButton userId={u.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <BroadcastForm audience="all users" />
      </div>
    </>
  );
}
