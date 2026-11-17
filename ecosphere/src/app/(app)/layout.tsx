import { BottomNav } from "@/components/BottomNav";
import { ScreenTransition } from "@/components/Motion";
import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student", PARENT: "Parent", EMPLOYEE: "Employee", TEACHER: "Teacher", HEALTH_MONITOR: "Health Monitor",
  SCHOOL_ADMIN: "School Admin", COMMUNITY: "Community Member", COMMUNITY_ADMIN: "Community Admin", SUPER_ADMIN: "Super Admin",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const place = user.school?.name ?? user.community ?? user.department ?? ROLE_LABEL[user.role];
  return (
    <div className="md:flex">
      <Sidebar sections={navFor(user.role)} user={{ name: user.name, avatar: user.avatar, place }} />
      {/* Phone: app column. Tablet/desktop: same screens, given room to breathe next to the sidebar. */}
      <div className="mx-auto w-full max-w-md pb-28 md:max-w-2xl md:px-6 md:pb-12 lg:max-w-3xl">
        <ScreenTransition>{children}</ScreenTransition>
      </div>
      <BottomNav />
    </div>
  );
}
