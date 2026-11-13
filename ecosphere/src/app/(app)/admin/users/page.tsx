import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BroadcastForm } from "@/components/BroadcastForm";
import { Header } from "@/components/ui";
import { toggleUserActive } from "../../../actions";

export default async function ManageUsers({ searchParams }: { searchParams: { q?: string } }) {
  const admin = await requireUser(["SUPER_ADMIN"]);
  const q = (searchParams.q ?? "").slice(0, 60);
  const users = await db.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" }, take: 100, include: { school: true },
  });
  return (
    <>
      <Header title="Manage Users" back="/profile" />
      <div className="flex flex-col gap-4 px-5">
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
                <form action={toggleUserActive.bind(null, u.id)}>
                  <button className={`chip ${u.active ? "" : "chip-on"}`}>{u.active ? "Disable" : "Enable"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <BroadcastForm audience="all users" />
      </div>
    </>
  );
}
