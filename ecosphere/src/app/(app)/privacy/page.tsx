import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { Header } from "@/components/ui";
import { deleteAccount } from "../../feature-actions";

const PRINCIPLES = [
  ["On-device AI", "Waste photos are classified by a model running in your browser. Images are never uploaded or stored."],
  ["Human in the loop", "The AI only suggests. You confirm or correct every category, and low-confidence results are flagged."],
  ["Honest limits", "The model recognises about 1,000 everyday objects and can be wrong. Impact numbers use published average factors, not audits."],
  ["Data minimisation", "We store only what's needed: name, email, school/class and your eco activity. No location tracking, no ads."],
  ["Role-based access", "Parents see only their linked children; teachers only their class; admins only their school. Every sensitive action is audit-logged."],
  ["Child safety", "Students can't message strangers. Marketplace hand-overs happen at school or in public places."],
  ["Your rights", "Download everything we hold about you, or delete your account at any time."],
];

export default async function Privacy() {
  const user = await requireUser();
  return (
    <>
      <Header title="Privacy & Responsible AI" back="/profile" />
      <div className="flex flex-col gap-4 px-5">
        <ul className="card divide-y divide-line">
          {PRINCIPLES.map(([t, d]) => <li key={t} className="p-4"><p className="text-sm font-medium text-leaf">{t}</p><p className="text-sm text-mute">{d}</p></li>)}
        </ul>
        <a href="/api/me" className="btn-ghost"><Download size={16} />Download my data (JSON)</a>
        {user.role !== "SUPER_ADMIN" && (
          <ActionForm action={deleteAccount} submit="Permanently delete my account" className="border-red-900">
            <h2 className="text-sm font-medium text-red-300">Delete account</h2>
            <p className="text-xs text-mute">This removes your profile, scans and points. It can&apos;t be undone.</p>
            <input name="password" type="password" required placeholder="Confirm with your password" aria-label="Password" className="input" />
          </ActionForm>
        )}
      </div>
    </>
  );
}
