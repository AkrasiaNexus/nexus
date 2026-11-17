import type { Role } from "./types";

// Single source of truth for navigation. Sections mirror the brief's categories; items are
// filtered by role so nobody sees a link to a page they're not allowed to open.
export type NavItem = { href: string; label: string; icon: string; roles?: Role[] };
export type NavSection = { title: string; items: NavItem[] };

const SCHOOL: Role[] = ["STUDENT", "PARENT", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN"];

export const NAV: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/home", label: "Dashboard", icon: "Home" },
      { href: "/stats", label: "Statistics", icon: "BarChart3" },
      { href: "/scan", label: "AI Waste Scanner", icon: "ScanLine" },
      { href: "/guide", label: "Recycling Guide", icon: "BookOpen" },
      { href: "/marketplace", label: "Marketplace", icon: "Store" },
      { href: "/rewards", label: "Green Points & Rewards", icon: "Gift" },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/profile", label: "Profile", icon: "User" },
      { href: "/notifications", label: "Notifications", icon: "Bell" },
      { href: "/history", label: "Activity History", icon: "History" },
      { href: "/settings", label: "Settings", icon: "Settings" },
    ],
  },
  {
    title: "School & Community",
    items: [
      { href: "/child", label: "Child Progress", icon: "Leaf", roles: ["PARENT"] },
      { href: "/tasks", label: "Class Tasks", icon: "ClipboardCheck", roles: ["STUDENT"] },
      { href: "/teacher", label: "My Class", icon: "School", roles: ["TEACHER"] },
      { href: "/department", label: "My Department", icon: "Building2", roles: ["EMPLOYEE"] },
      { href: "/health", label: "Health & Safety", icon: "HeartPulse", roles: SCHOOL },
      { href: "/community", label: "My Community", icon: "UsersRound", roles: ["COMMUNITY", "COMMUNITY_ADMIN"] },
      { href: "/events", label: "Events & Campaigns", icon: "CalendarDays" },
      { href: "/impact", label: "SDG Impact", icon: "Globe2" },
      { href: "/partners", label: "Recycling Partners", icon: "Handshake" },
    ],
  },
  {
    title: "Admin Management",
    items: [
      { href: "/school", label: "School Reports", icon: "FileBarChart", roles: ["SCHOOL_ADMIN"] },
      { href: "/school/classes", label: "Manage Classes", icon: "Users", roles: ["SCHOOL_ADMIN"] },
      { href: "/school/staff", label: "Manage Staff", icon: "UsersRound", roles: ["SCHOOL_ADMIN"] },
      { href: "/admin/users", label: "Manage Users", icon: "Users", roles: ["SUPER_ADMIN"] },
      { href: "/admin/system", label: "System Settings", icon: "SlidersHorizontal", roles: ["SUPER_ADMIN"] },
      { href: "/admin/audit", label: "Audit Logs", icon: "ScrollText", roles: ["SUPER_ADMIN"] },
      { href: "/admin/export", label: "Export Data", icon: "Download", roles: ["SUPER_ADMIN"] },
    ],
  },
];

export const navFor = (role: Role) =>
  NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((s) => s.items.length);
