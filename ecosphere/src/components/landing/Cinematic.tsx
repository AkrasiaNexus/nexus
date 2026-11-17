"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { createAnimatable, createScope } from "animejs";
import { LeafLogo } from "@/components/art";
import { Critter } from "@/components/Critter";
import { Glyph } from "@/components/Glyph";
import { Phone } from "./Phone";
import { HomeScreen, MarketScreen, RewardsScreen, ROLES, RoleScreens, ScannerScreen, StatsScreen, WelcomeScreen } from "./Screens";
import { CHAPTERS } from "./chapters";
import { buildTimeline } from "./timeline";
import "./phone.css";
import "./cinematic.css";

// Headline split into words so the timeline can stagger them and light up the key ones.
function Words({ text, hl }: { text: string; hl: readonly string[] }) {
  return <>{text.split(" ").map((w, i) => <span key={i} data-word {...(hl.includes(w) ? { "data-hl": "" } : {})} className="inline-block whitespace-pre" style={{ opacity: 0 }}>{w} </span>)}</>;
}

export function Cinematic() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    // Responsive animation scope: the timeline is rebuilt (and the old one reverted) when these queries flip.
    // The track height differs per layout, so keep the visitor's place in the story, not their pixel offset.
    const track = root.current!.querySelector<HTMLElement>("[data-track]")!;
    const place = () => (window.scrollY - track.offsetTop) / Math.max(1, track.offsetHeight - window.innerHeight);
    // Recorded only while the layout is stable: during a resize the CSS height has already changed under us.
    let resume = place(), stableWidth = window.innerWidth;
    const remember = () => { if (window.innerWidth === stableWidth) resume = place(); };
    window.addEventListener("scroll", remember, { passive: true });
    const scope = createScope({ root: root.current!, mediaQueries: { mobile: "(max-width: 767px)", reduce: "(prefers-reduced-motion: reduce)" } })
      .add((self) => {
        if (window.innerWidth !== stableWidth && resume > 0 && resume < 1) window.scrollTo(0, track.offsetTop + resume * (track.offsetHeight - window.innerHeight));
        stableWidth = window.innerWidth;
        const tl = buildTimeline(root.current!, { mobile: !!self?.matches.mobile, reduce: !!self?.matches.reduce });
        // The hook reacts in the first second: on a mouse/trackpad the phone leans toward the cursor,
        // layered on top of (not fighting) the scroll timeline, which owns the outer rig.
        let off = () => {};
        if (!self?.matches.reduce && window.matchMedia("(pointer: fine)").matches) {
          const tilt = createAnimatable(root.current!.querySelector<HTMLElement>("[data-tilt]")!, { rotateX: 900, rotateY: 900, ease: "out(3)" });
          const lean = (e: PointerEvent) => { tilt.rotateY((e.clientX / window.innerWidth - 0.5) * 14); tilt.rotateX(-(e.clientY / window.innerHeight - 0.5) * 9); };
          window.addEventListener("pointermove", lean, { passive: true });
          off = () => window.removeEventListener("pointermove", lean);
        }
        return () => { off(); tl.revert(); };
      });
    // A resize that stays within one layout just re-baselines; crossing the breakpoint is handled by the scope rebuild above.
    let lastMobile = window.matchMedia("(max-width: 767px)").matches;
    const settle = () => {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      if (mobile === lastMobile && window.innerWidth !== stableWidth) { stableWidth = window.innerWidth; resume = place(); }
      lastMobile = mobile;
    };
    window.addEventListener("resize", settle);
    return () => { scope.revert(); window.removeEventListener("scroll", remember); window.removeEventListener("resize", settle); };
  }, []);

  // Nav/footer jumps land on a chapter's place in the pinned track.
  const jump = (chapter: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const track = root.current!.querySelector<HTMLElement>("[data-track]")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((track.offsetHeight - window.innerHeight) * (chapter + 0.45)) / 10, behavior: "smooth" });
  };

  return (
    <main ref={root} className="cine">
      <nav className="cine-nav" aria-label="Main">
        <a href="#top" onClick={jump(0)} className="flex items-center gap-2 font-semibold"><LeafLogo size={22} />EcoSphere <span className="text-leaf">AI</span></a>
        <div className="flex items-center gap-1 text-sm">
          <a href="#features" onClick={jump(2)} className="hidden rounded-full px-3 py-2 text-white/70 hover:text-white sm:inline">Features</a>
          <Link href="/login" className="rounded-full px-3 py-2 text-white/70 hover:text-white">Log in</Link>
          <Link href="/signup" className="rounded-full bg-leaf px-4 py-2 font-semibold text-ink hover:brightness-105">Get started</Link>
        </div>
      </nav>

      <section data-track className="cine-track" id="top">
        <div className="cine-stage">
          <div data-bg="glow" className="cine-glow" style={{ opacity: 0 }} />
          <div data-bg="nature" className="cine-nature" style={{ opacity: 0 }} aria-hidden>
            {[["8%", "62%", 380, -20], ["74%", "12%", 300, 140], ["84%", "68%", 240, 200], ["14%", "8%", 220, 40], ["50%", "84%", 280, -90]].map(([l, t, s, r], i) => (
              <svg key={i} data-leafbg viewBox="0 0 64 64" className="absolute" style={{ left: l as string, top: t as string, width: s as number, rotate: `${r}deg`, filter: i % 2 ? "blur(3px)" : undefined, opacity: i % 2 ? 0.55 : 1 }}>
                <path d="M56 6C30 6 10 20 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 41-18 37-50z" fill="url(#leafg)" />
                <path d="M14 56C20 40 30 28 44 18" fill="none" stroke="#a2d47e" strokeOpacity=".25" strokeWidth=".8" />
              </svg>
            ))}
            <svg width="0" height="0"><defs><linearGradient id="leafg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#13301b" /><stop offset="1" stopColor="#2c5233" stopOpacity=".55" /></linearGradient></defs></svg>
          </div>

          <div data-intro-logo className="cine-intro-logo">
            <span className="cine-logo-in"><LeafLogo size={44} /></span>
            <span className="cine-logo-in text-lg font-semibold tracking-tight" style={{ animationDelay: "250ms" }}>EcoSphere <span className="text-leaf">AI</span></span>
            <span className="cine-logo-in mt-6 text-[11px] uppercase tracking-[0.3em] text-white/40" style={{ animationDelay: "900ms" }}>Scroll</span>
          </div>

          {CHAPTERS.map((c, i) => (
            <div key={c.id} data-ch={i} className={`cine-text ${i === 0 || i === 1 || i >= 8 ? "cine-text-center" : ""}`} id={i === 2 ? "features" : undefined}>
              <h2 className="cine-h"><Words text={c.title} hl={c.hl} /></h2>
              {c.body && <p data-rest className="cine-p" style={{ opacity: 0 }}>{c.body}</p>}
              {c.id === "roles" && (
                <ol data-rest className="mt-6 flex flex-wrap gap-2" style={{ opacity: 0 }} aria-label="Roles">
                  {ROLES.map((r) => <li key={r.key} data-role-label className="rounded-full border border-white/15 px-3 py-1 text-xs" style={{ opacity: 0.35 }}>{r.label}</li>)}
                </ol>
              )}
            </div>
          ))}

          <div data-chip="progress" className="cine-chip" style={{ opacity: 0 }}>
            <span className="text-[11px] text-white/55">Your environmental progress</span>
            <span className="text-lg font-semibold">78% <span className="text-xs font-normal text-white/45">of monthly goal · demo</span></span>
          </div>
          {Array.from({ length: 10 }, (_, i) => <span key={i} data-particle className="cine-particle" style={{ opacity: 0, left: `${46 + (i % 5) * 3}%`, top: `${44 + Math.floor(i / 5) * 8}%` }} />)}

          <div data-bottle className="cine-bottle" style={{ opacity: 0 }} aria-hidden>
            <svg viewBox="0 0 48 48" className="h-full w-full text-[#dcedf2]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 5h8v6l3.5 4.5V40a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V15.5L20 11z" fill="#7cc3d61c" />
              <rect x="16.5" y="22" width="15" height="9" fill="#7cc3d6" stroke="none" opacity=".8" />
              <path data-bottle-outline d="M20 5h8v6l3.5 4.5V40a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V15.5L20 11z" stroke="#a2d47e" strokeWidth="1" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} style={{ filter: "drop-shadow(0 0 2px #a2d47e)" }} transform="translate(24 24) scale(1.12) translate(-24 -24)" />
            </svg>
            <div data-bottle-beam className="cine-beam" style={{ opacity: 0 }} />
            <div data-bottle-tag className="cine-tag" style={{ opacity: 0 }}>Plastic · PET bottle<span className="text-white/45"> · sample</span></div>
          </div>

          <div data-panel className="cine-panel" style={{ opacity: 0 }} aria-hidden>
            <p className="text-xs text-white/55">Waste sorted · last 8 weeks <span className="text-white/35">· demo</span></p>
            <svg viewBox="0 0 300 110" className="mt-3 w-full overflow-visible">
              {[20, 55, 90].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#fff" strokeOpacity=".06" />)}
              <path d="M0 95 L0 95 C30 88 50 70 80 72 S130 90 160 60 S220 30 250 34 S285 18 300 14 L300 110 L0 110Z" fill="#a2d47e" fillOpacity=".08" />
              <path data-draw d="M0 95 C30 88 50 70 80 72 S130 90 160 60 S220 30 250 34 S285 18 300 14" fill="none" stroke="#a2d47e" strokeWidth="2.4" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            </svg>
            <p className="mt-2 text-2xl font-semibold">+38% <span className="text-sm font-normal text-white/50">vs. last term</span></p>
          </div>

          <div data-exchange className="cine-exchange" style={{ opacity: 0 }} aria-hidden>
            <Critter avatar="c:2-6-1-3-0" size={44} />
            <span className="relative mx-2 h-px flex-1 bg-white/15"><span data-token className="absolute -top-3 left-0 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-[#2b2419] ring-1 ring-[#e9b44c]"><Glyph name="books" accent="#e9b44c" className="h-4 w-4 text-[#f3e9d6]" /></span></span>
            <Critter avatar="c:0-1-2-1-1" size={44} />
            <span className="absolute -bottom-6 left-0 right-0 text-center text-[11px] text-white/50">Donated · second life</span>
          </div>

          <div data-shadow className="cine-shadow" aria-hidden />
          <div data-rig className="cine-rig">
            <div data-tilt className="cine-tilt">
              <Phone screen={<><WelcomeScreen /><HomeScreen /><ScannerScreen /><StatsScreen /><MarketScreen /><RewardsScreen /><RoleScreens /></>} />
            </div>
          </div>

          <div data-final-logo className="cine-final-logo" style={{ opacity: 0 }}><LeafLogo size={40} /><span className="text-xl font-semibold">EcoSphere <span className="text-leaf">AI</span></span></div>
          <div data-cta className="cine-cta" style={{ opacity: 0, pointerEvents: "none" }}>
            <Link href="/login" className="btn-ghost bg-black/40 px-6">Explore EcoSphere AI</Link>
            <Link href="/signup" className="btn px-6">Get Started</Link>
          </div>
        </div>
      </section>

      <footer className="cine-footer">
        <span className="flex items-center gap-2 text-white/70"><LeafLogo size={18} />EcoSphere AI · SDG 12</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="#top" onClick={jump(8)}>About</a>
          <a href="#features" onClick={jump(2)}>Features</a>
          <Link href="/legal#contact">Contact</Link>
          <Link href="/legal#privacy">Privacy</Link>
          <Link href="/legal#terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
