"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Circle, BarChart3, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, Download, FileBarChart, Gift, Globe2, Handshake, HeartPulse, History, Home, Leaf, ScanLine, School, ScrollText, Settings, SlidersHorizontal, Store, User, Users, UsersRound, type LucideIcon } from "lucide-react";
import type { NavSection } from "@/lib/nav";
import { LeafLogo } from "./art";

// Explicit map keeps the bundle to the icons the nav actually uses.
const ICONS: Record<string, LucideIcon> = { BarChart3, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, Download, FileBarChart, Gift, Globe2, Handshake, HeartPulse, History, Home, Leaf, ScanLine, School, ScrollText, Settings, SlidersHorizontal, Store, User, Users, UsersRound };
const icon = (name: string) => ICONS[name] ?? Circle;

// Tablet: icon rail. Desktop: labelled sidebar. Hidden on phones (BottomNav takes over).
export function Sidebar({ sections, user }: { sections: NavSection[]; user: { name: string; avatar: string; place: string } }) {
  const path = usePathname();
  const isOn = (href: string) => path === href || (href !== "/home" && path.startsWith(href + "/")) || path === href;
  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col border-r border-white/[.05] bg-[#0f1211]/80 py-5 backdrop-blur md:flex lg:w-64">
      <Link href="/home" className="mb-6 flex items-center gap-2.5 px-5">
        <LeafLogo size={30} />
        <span className="hidden text-lg font-semibold tracking-tight lg:inline">EcoSphere <span className="text-leaf">AI</span></span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3" aria-label="Main navigation">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="mb-1.5 hidden px-3 text-[11px] font-medium uppercase tracking-wider text-white/35 lg:block">{s.title}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const Icon = icon(item.icon);
                const on = isOn(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={on ? "page" : undefined} title={item.label}
                      className={`group flex items-center justify-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors lg:justify-start ${on ? "bg-forest/60 text-white" : "text-white/60 hover:bg-white/[.04] hover:text-white"}`}>
                      <Icon size={18} className={on ? "text-leaf" : ""} />
                      <span className="hidden truncate lg:inline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <Link href="/profile" className="mx-3 mt-4 flex items-center justify-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[.04] lg:justify-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-lg">{user.avatar}</span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm">{user.name}</span>
          <span className="block truncate text-xs text-white/45">{user.place}</span>
        </span>
      </Link>
    </aside>
  );
}
