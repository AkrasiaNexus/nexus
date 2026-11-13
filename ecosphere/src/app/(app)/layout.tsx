import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
