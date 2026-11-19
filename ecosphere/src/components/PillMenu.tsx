"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Pill dropdown (mockup "School ⌄", "This Month ⌄") built on <details>; picking an option closes it.
export function PillMenu({ label, items, className = "" }: { label: string; items: { href: string; label: string; on?: boolean }[]; className?: string }) {
  return (
    <details className={`group relative ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/[.06] bg-card px-4 py-2 text-sm [&::-webkit-details-marker]:hidden">
        {label}<ChevronRight size={14} className="rotate-90 transition group-open:-rotate-90" />
      </summary>
      <ul className="absolute left-1/2 z-30 mt-1 min-w-full -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#121b15] shadow-xl">
        {items.map((i) => <li key={i.href}><Link href={i.href} scroll={false} onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
          className={`block whitespace-nowrap px-4 py-2 text-sm hover:bg-white/5 ${i.on ? "text-leaf" : ""}`}>{i.label}</Link></li>)}
      </ul>
    </details>
  );
}
