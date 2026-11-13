"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, ScanLine, ShoppingBag, User } from "lucide-react";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/marketplace", label: "Market", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-ink/95 backdrop-blur">
      <ul className="flex justify-around py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = path.startsWith(href);
          const scan = href === "/scan";
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 text-[11px] ${on ? "text-leaf" : "text-mute"}`}>
                <span className={scan ? "-mt-6 rounded-full bg-leaf p-3 text-ink shadow-lg shadow-leaf/30" : ""}>
                  <Icon size={scan ? 24 : 20} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
