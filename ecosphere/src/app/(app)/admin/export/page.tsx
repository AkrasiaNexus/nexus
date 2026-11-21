import { requireUser } from "@/lib/auth";
import { ExportLinks } from "@/components/ExportLinks";
import { Header } from "@/components/ui";

export default async function ExportPage() {
  await requireUser(["SUPER_ADMIN"]);
  return (
    <>
      <Header title="Export Data" back="/profile" />
      <div className="px-5"><ExportLinks /><p className="mt-3 text-xs text-mute">Every export is recorded in the audit log.</p></div>
    </>
  );
}
