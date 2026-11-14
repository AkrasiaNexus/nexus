"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanSearch, ShoppingBasket, User } from "lucide-react";

// Same 4 tabs as the mockup.
const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/stats", label: "Stats", icon: ScanSearch },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBasket },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl border-t border-white/[.06] bg-[#0b110d]/95 backdrop-blur">
      <ul className="flex justify-around pb-3 pt-2.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-3 text-[11px] ${on ? "font-semibold text-leaf" : "text-white/60"}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
