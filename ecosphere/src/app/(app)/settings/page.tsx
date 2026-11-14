import Link from "next/link";
import { Bell, ChevronRight, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { logout, setAvatar, updateSettings } from "../../actions";

const AVATARS = ["🌱", "🧑‍🎓", "👩‍🎓", "🧑‍💼", "👪", "🌍", "🦊", "🐢", "🌻", "🏫"];

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <Header title="Settings" back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        <p className="text-center text-sm text-white/60">EcoSphere ID <span className="chip ml-1 font-mono">{user.memberId}</span></p>
        <section id="avatar" className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Avatar</h2>
          <div className="grid grid-cols-5 gap-3">
            {AVATARS.map((a) => (
              <form key={a} action={setAvatar.bind(null, a)}>
                <button aria-label={`Use avatar ${a}`} className={`grid aspect-square w-full place-items-center rounded-2xl bg-panel text-3xl ${a === user.avatar ? "ring-2 ring-leaf" : ""}`}>{a}</button>
              </form>
            ))}
          </div>
        </section>
        <ActionForm action={updateSettings} submit="Save changes">
          <h2 className="text-sm font-medium">Profile & password</h2>
          <input name="name" required minLength={2} maxLength={60} defaultValue={user.name} aria-label="Name" className="input" />
          <input name="current" type="password" autoComplete="current-password" placeholder="Current password (to change it)" aria-label="Current password" className="input" />
          <input name="next" type="password" autoComplete="new-password" minLength={8} placeholder="New password (8+ characters)" aria-label="New password" className="input" />
        </ActionForm>
        <nav className="card overflow-hidden">
          <Link href="/notifications" className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm"><Bell size={20} className="text-white/70" /><span className="flex-1">Notifications</span><ChevronRight size={16} className="text-white/50" /></Link>
          <Link href="/privacy" className="flex items-center gap-3 px-4 py-3 text-sm"><Lock size={20} className="text-white/70" /><span className="flex-1">Privacy, responsible AI & my data</span><ChevronRight size={16} className="text-white/50" /></Link>
        </nav>
        <form action={logout}><button className="btn-ghost w-full">Log out</button></form>
      </div>
    </>
  );
}
