"use client";

import { useEffect } from "react";

// Cursor light: one pointer listener feeds CSS variables. The page glow reads --gx/--gy on <html>;
// the card under the cursor gets --mx/--my for its own sheen. Mouse/trackpad only, never on touch.
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    let frame = 0, last: PointerEvent | null = null, lit: HTMLElement | null = null;
    const paint = () => {
      frame = 0;
      if (!last) return;
      root.style.setProperty("--gx", `${last.clientX}px`);
      root.style.setProperty("--gy", `${last.clientY}px`);
      const card = (last.target as Element | null)?.closest?.<HTMLElement>(".card") ?? null;
      if (lit && lit !== card) lit.removeAttribute("data-lit");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${last.clientX - r.left}px`);
        card.style.setProperty("--my", `${last.clientY - r.top}px`);
        card.setAttribute("data-lit", "");
      }
      lit = card;
    };
    const move = (e: PointerEvent) => { last = e; root.setAttribute("data-glow", ""); frame ||= requestAnimationFrame(paint); };
    const leave = () => { root.removeAttribute("data-glow"); lit?.removeAttribute("data-lit"); lit = null; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => { window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); cancelAnimationFrame(frame); };
  }, []);
  return <div aria-hidden className="spotlight-page pointer-events-none fixed inset-0 z-0" />;
}
