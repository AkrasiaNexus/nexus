import Link from "next/link";
import { Bell, ChevronRight, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { answerParentRequest, logout, updateSettings } from "../../actions";
import { publicNames } from "@/lib/queries";
import { MUTABLE_KINDS } from "@/lib/notices";
import { AvatarPicker } from "@/components/AvatarPicker";
import { setMutedKinds } from "../../notification-actions";


export default async function SettingsPage() {
  const user = await requireUser();
  const pendingId = user.pendingParentId;
  const pendingParent = pendingId ? (await publicNames([pendingId])).get(pendingId) ?? { name: "Someone" } : null;
  return (
    <>
      <Header title="Settings" back="/profile" />
      <div className="stagger flex flex-col gap-4 px-5">
        {pendingParent && (
          <section role="alert" className="card space-y-3 border-gold/40 p-4">
            <p className="text-sm"><b>{pendingParent.name}</b> asked to link as your parent. They&apos;d see your scans, tasks and classroom health alerts.</p>
            <p className="text-xs text-white/60">Only approve someone you know.</p>
            <div className="flex gap-2">
              <form action={answerParentRequest.bind(null, true)} className="flex-1"><button className="btn w-full py-2 text-sm">Approve</button></form>
              <form action={answerParentRequest.bind(null, false)} className="flex-1"><button className="btn-ghost w-full py-2 text-sm">Decline</button></form>
            </div>
          </section>
        )}
        <ActionForm id="notifications" action={setMutedKinds} submit="Save notification preferences">
          <h2 className="font-semibold">Notification preferences</h2>
          <p className="text-xs text-mute">Muted categories are hidden from your feed and badge. Health &amp; safety alerts can&apos;t be muted.</p>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Mute these categories</legend>
            {Object.entries(MUTABLE_KINDS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="muted" value={k} defaultChecked={user.mutedKinds?.includes(k)} className="accent-[#a2d47e]" /> Mute {v.toLowerCase()}
              </label>
            ))}
          </fieldset>
        </ActionForm>
        <p className="text-center text-sm text-white/60">EcoSphere ID <span className="chip ml-1 font-mono">{user.memberId}</span></p>
        <section id="avatar" className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Your character</h2>
          <AvatarPicker current={user.avatar} />
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
