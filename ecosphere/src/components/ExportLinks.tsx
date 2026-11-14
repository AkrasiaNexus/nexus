import { Download } from "lucide-react";

const TYPES = [["scans", "Waste records & AI classifications"], ["health", "Health & safety reports"], ["users", "Users & green points"]];

export function ExportLinks() {
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-medium">Export data (CSV)</h2>
      <ul className="space-y-2">
        {TYPES.map(([t, label]) => (
          <li key={t}><a href={`/api/export?type=${t}`} className="flex items-center gap-2 text-sm text-leaf hover:underline"><Download size={14} />{label}</a></li>
        ))}
      </ul>
    </section>
  );
}
