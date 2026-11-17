import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { createCommunity } from "../../../admin-actions";

export default async function Communities() {
  await requireUser(["SUPER_ADMIN"]);
  const db = admin(); // super admin only (checked above)
  const [{ data: communities }, { data: members }] = await Promise.all([
    db.from("communities").select("id, name, city, description").order("name"),
    db.from("profiles").select("id, name, communityId, role, active").not("communityId", "is", null),
  ]);
  return (
    <>
      <Header title="Communities" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        <ul className="stagger-slow card overflow-hidden">
          {communities?.map((c) => {
            const mine = (members ?? []).filter((m) => m.communityId === c.id);
            const admins = mine.filter((m) => m.role === "COMMUNITY_ADMIN");
            return (
              <li key={c.id}>
                <Link href={`/admin/users?community=${c.id}`} className="flex items-center gap-3 border-b border-line p-4 text-sm hover:bg-panel">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="truncate text-xs text-mute">{[c.city, c.description].filter(Boolean).join(" · ") || "No description"}</p>
                  </div>
                  <p className="text-right text-xs text-mute">
                    {mine.length} members
                    <span className={`block ${admins.some((a) => a.active) ? "" : "text-gold"}`}>
                      {admins.length ? `Admin: ${admins.map((a) => a.name + (a.active ? "" : " (pending)")).join(", ")}` : "No admin yet"}
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
          {!communities?.length && <li className="p-6 text-center text-sm text-mute">No communities yet.</li>}
        </ul>
        <ActionForm action={createCommunity} submit="Add community">
          <h2 className="font-semibold">Add a community</h2>
          <input name="name" required minLength={2} maxLength={80} placeholder="Community name" aria-label="Community name" className="input" />
          <input name="city" maxLength={60} placeholder="City (optional)" aria-label="City" className="input" />
          <input name="description" maxLength={200} placeholder="Short description (optional)" aria-label="Description" className="input" />
          <p className="text-[11px] text-mute">To assign an admin, open a member in Manage Users and set the role to Community Admin.</p>
        </ActionForm>
      </div>
    </>
  );
}
