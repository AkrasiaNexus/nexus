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
  const active = TABS.findIndex((t) => path.startsWith(t.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl border-t border-white/[.06] bg-[#0b110d]/95 backdrop-blur">
      {/* Shared indicator: glides to the active tab so the switch reads as one continuous move. */}
      <span aria-hidden className="pointer-events-none absolute top-0 flex w-1/4 justify-center transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${Math.max(0, active) * 100}%)`, opacity: active < 0 ? 0 : 1 }}>
        <span className="h-[3px] w-8 rounded-b-full bg-leaf" />
      </span>
      <ul className="grid grid-cols-4 pb-3 pt-2.5">
        {TABS.map(({ href, label, icon: Icon }, i) => {
          const on = i === active;
          return (
            <li key={href} className="flex justify-center">
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`press flex flex-col items-center gap-1 px-3 text-[11px] transition-colors duration-200 ${on ? "font-semibold text-leaf" : "text-white/60"}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={`transition-transform duration-300 ${on ? "-translate-y-0.5" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
