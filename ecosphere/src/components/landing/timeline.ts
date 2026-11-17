import { createTimeline, onScroll, stagger, type Timeline } from "animejs";
import { veinFill } from "@/lib/leaf";

const C = 1000; // one chapter of timeline time
const at = (chapter: number, frac = 0) => chapter * C + frac * C;

type Opts = { mobile: boolean; reduce: boolean };

// One master timeline for the whole story, scrubbed by scroll (both directions) through Anime's ScrollObserver.
export function buildTimeline(root: HTMLElement, { mobile, reduce }: Opts): Timeline {
  const $ = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const $$ = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  const track = $("[data-track]");
  const rig = $("[data-rig]");
  const screenRoot = $("[data-screen-root]");
  const cta = $("[data-cta]");

  const tl = createTimeline({
    defaults: { ease: "inOut(2)", duration: C * 0.4 },
    autoplay: onScroll({ target: track, enter: "top top", leave: "bottom bottom", sync: 0.5 }),
    // Only the final chapter's buttons may take clicks; earlier they're invisible.
    onUpdate: (self) => {
      const live = self.progress > 0.93;
      cta.style.pointerEvents = live ? "auto" : "none";
      cta.toggleAttribute("inert", !live);
    },
  });

  // Phone pose per chapter. Reduced motion keeps the phone still (content still changes in place).
  const shadow = $("[data-shadow]");
  const pose = (chapter: number, frac: number, props: Record<string, unknown>, dur = C * 0.45) => {
    if (reduce) return;
    tl.add(rig, { ...props, duration: dur }, at(chapter, frac));
    const { x, y, scale, opacity } = props as Record<string, unknown>;
    const follow = Object.fromEntries(Object.entries({ x, y, scale, opacity }).filter(([, v]) => v !== undefined));
    if (Object.keys(follow).length) tl.add(shadow, { ...follow, duration: dur }, at(chapter, frac));
  };
  const side = mobile ? "0vw" : "15vw";

  // Screen helpers: crossfade inside the same phone.
  const scr = (name: string) => $(`[data-scr="${name}"]`);
  const swap = (from: string | null, to: string, t: number, dur = C * 0.18) => {
    if (from) tl.add(scr(from), { opacity: 0, scale: reduce ? 1 : 1.04, duration: dur }, t);
    tl.add(scr(to), { opacity: [0, 1], scale: reduce ? [1, 1] : [0.96, 1], duration: dur }, t);
  };
  const counters = (scope: HTMLElement, t: number, dur = C * 0.35) => {
    scope.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const to = Number(el.dataset.count), dp = Number(el.dataset.dp ?? 0), suffix = el.dataset.suffix ?? "";
      const o = { v: 0 };
      tl.add(o, { v: to, duration: dur, ease: "out(3)", onUpdate: () => { el.textContent = o.v.toFixed(dp) + suffix; } }, t);
    });
  };

  // Chapter copy: reveal, highlight key words, then hand over to the next chapter.
  for (let i = 0; i < 10; i++) {
    const block = root.querySelector<HTMLElement>(`[data-ch="${i}"]`);
    if (!block) continue;
    const words = Array.from(block.querySelectorAll<HTMLElement>("[data-word]"));
    const start = i === 0 ? 0.12 : 0.08;
    tl.add(words, { opacity: [0, 1], y: reduce ? [0, 0] : ["0.6em", "0em"], delay: stagger(C * 0.012), duration: C * 0.16 }, at(i, start));
    const rest = block.querySelectorAll<HTMLElement>("[data-rest]");
    if (rest.length) tl.add(rest, { opacity: [0, 1], y: reduce ? [0, 0] : [16, 0], duration: C * 0.16, delay: stagger(C * 0.04) }, at(i, start + 0.12));
    const hl = block.querySelectorAll<HTMLElement>("[data-hl]");
    if (hl.length) tl.add(hl, { color: ["#ffffff", "#a2d47e"], duration: C * 0.12, delay: stagger(C * 0.04) }, at(i, start + 0.2));
    // Hand-over fades the whole block at once: a single tween renders reliably even when a fast scroll jumps past it.
    if (i < 9) tl.add(block, { opacity: [1, 0], y: reduce ? [0, 0] : [0, -24], duration: C * 0.12 }, at(i, 0.86));
  }

  // 01 Introduction: the phone rises out of the dark, its edges catch the light, the screen powers on.
  tl.add($("[data-intro-logo]"), { opacity: 0, y: reduce ? 0 : -40, scale: reduce ? 1 : 0.9, duration: C * 0.3 }, at(0, 0.25));
  pose(0, 0, { y: ["38vh", mobile ? "-4vh" : "-6vh"], scale: [mobile ? 0.62 : 0.7, mobile ? 0.72 : 0.84], rotateX: [24, 0], rotateZ: [-6, 0], opacity: [0.35, 1] }, C * 0.75);
  tl.add($("[data-bg='glow']"), { opacity: [0, 1], scale: reduce ? [1, 1] : [0.6, 1], duration: C * 0.6 }, at(0, 0.2));
  tl.add(screenRoot, { opacity: [0, 1], filter: ["brightness(0.2)", "brightness(1)"], duration: C * 0.35 }, at(0, 0.62));
  swap(null, "welcome", at(0, 0.62), C * 0.01);
  tl.add($$("[data-w]"), { opacity: [0, 1], y: reduce ? [0, 0] : [10, 0], delay: stagger(C * 0.06), duration: C * 0.2 }, at(0, 0.7));

  // 02 Wake up → enter the app: the welcome screen zooms past and the dashboard takes over.
  pose(1, 0.1, { scale: mobile ? 0.74 : 0.86, rotateY: reduce ? 0 : -8 }, C * 0.4);
  swap("welcome", "home", at(1, 0.6), C * 0.25);

  // 03 Dashboard: the leaf grows vein by vein, numbers climb, light particles drift off the phone.
  pose(2, 0, { x: side, y: "0vh", rotateY: 0, scale: mobile ? 0.74 : 1.04 }, C * 0.4);
  const veins = Array.from(scr("home").querySelectorAll<SVGPathElement>("[data-vein]"));
  const leaf = { g: 0 };
  tl.add(leaf, {
    g: 0.78, duration: C * 0.5, ease: "out(2)",
    onUpdate: () => veins.forEach((v) => { v.style.strokeDashoffset = String(1 - veinFill(leaf.g, { start: Number(v.dataset.start), len: Number(v.dataset.len) })); }),
  }, at(2, 0.15));
  counters(scr("home"), at(2, 0.2));
  tl.add($("[data-chip='progress']"), { opacity: [0, 1], x: reduce ? [0, 0] : [-20, 0], duration: C * 0.2 }, at(2, 0.4));
  tl.add($("[data-chip='progress']"), { opacity: 0, duration: C * 0.12 }, at(2, 0.88));
  if (!reduce) tl.add($$("[data-particle]"), {
    opacity: [{ to: 0.9, duration: C * 0.1 }, { to: 0, duration: C * 0.3 }], y: [0, () => -60 - Math.random() * 80], x: () => (Math.random() - 0.5) * 120,
    delay: stagger(C * 0.03), duration: C * 0.4,
  }, at(2, 0.3));

  // 04 AI scanner: tilt, turn to the camera, scan a bottle, then swing back to the result on screen.
  pose(3, 0, { x: mobile ? "0vw" : "8vw", y: mobile ? "8vh" : "0vh", rotateY: 160, rotateX: 8, rotateZ: -4, scale: mobile ? 0.62 : 1 }, C * 0.35);
  pose(3, 0.35, { rotateY: 185, rotateX: 0, rotateZ: 0 }, C * 0.1);
  swap("home", "scan", at(3, 0.2), C * 0.02); // swapped while facing away
  const bottle = $("[data-bottle]");
  tl.add(bottle, { opacity: [0, 1], x: reduce ? [0, 0] : [30, 0], duration: C * 0.15 }, at(3, 0.3));
  tl.add($("[data-bottle-beam]"), { opacity: [{ to: 1, duration: C * 0.03 }, { to: 0, duration: C * 0.03, delay: C * 0.16 }], y: ["-10%", "110%"], duration: C * 0.22, ease: "inOut(1)" }, at(3, 0.42));
  tl.add($("[data-bottle-outline]"), { strokeDashoffset: [1, 0], duration: C * 0.18 }, at(3, 0.5));
  tl.add($("[data-bottle-tag]"), { opacity: [0, 1], y: reduce ? [0, 0] : [10, 0], duration: C * 0.1 }, at(3, 0.62));
  pose(3, 0.68, { rotateY: 360, x: side, y: "0vh", scale: mobile ? 0.74 : 1 }, C * 0.22);
  tl.add(bottle, { opacity: 0, duration: C * 0.12 }, at(3, 0.78));
  const scan = scr("scan");
  tl.add(scan.querySelector("[data-s='beam']")!, { y: ["-100%", "300%"], duration: C * 0.15, ease: "linear" }, at(3, 0.7));
  tl.add(scan.querySelector("[data-s='result']")!, { opacity: [0, 1], y: reduce ? [0, 0] : [20, 0], duration: C * 0.12 }, at(3, 0.8));
  tl.add(scan.querySelector("[data-s='conf']")!, { scaleX: [0, 1], duration: C * 0.12 }, at(3, 0.84));
  counters(scan, at(3, 0.84), C * 0.12);

  // 05 Statistics: ticks light, the line draws, bars grow, a bigger chart slides out of the phone and back.
  pose(4, 0, { rotateY: 360, x: side, scale: mobile ? 0.74 : 1.02 }, C * 0.3);
  swap("scan", "stats", at(4, 0.05), C * 0.2);
  const stats = scr("stats");
  const ticks = Array.from(stats.querySelectorAll<SVGLineElement>("[data-tick]"));
  const ring = { p: 0 };
  tl.add(ring, { p: 0.79, duration: C * 0.35, ease: "out(2)", onUpdate: () => ticks.forEach((t) => t.setAttribute("stroke", Number(t.dataset.tick) < ring.p ? "#a2d47e" : "#2a332d")) }, at(4, 0.18));
  counters(stats, at(4, 0.18));
  tl.add(stats.querySelector("[data-draw]")!, { strokeDashoffset: [1, 0], duration: C * 0.3 }, at(4, 0.25));
  tl.add(Array.from(stats.querySelectorAll("[data-bar]")), { scaleY: [0, 1], delay: stagger(C * 0.03), duration: C * 0.2, ease: "out(3)" }, at(4, 0.3));
  const panel = $("[data-panel]");
  tl.add(panel, { opacity: [0, 1], x: reduce || mobile ? [0, 0] : [0, "-2vw"], y: reduce ? [0, 0] : [0, mobile ? "-6vh" : "-15vh"], scale: reduce ? [1, 1] : [0.4, 1], duration: C * 0.22 }, at(4, 0.45));
  tl.add(panel.querySelector("[data-draw]")!, { strokeDashoffset: [1, 0], duration: C * 0.2 }, at(4, 0.52));
  tl.add(panel, { opacity: 0, x: 0, y: 0, scale: reduce ? 1 : 0.4, duration: C * 0.18 }, at(4, 0.8));

  // 06 Marketplace: cards deal in, one opens up, an item changes hands, then the shelf restocks.
  pose(5, 0, { rotateY: reduce ? 360 : 348, rotateZ: reduce ? 0 : 2, x: side }, C * 0.3);
  swap("stats", "market", at(5, 0.05), C * 0.2);
  const market = scr("market");
  const cardsA = Array.from(market.querySelectorAll<HTMLElement>("[data-m='a'] > *"));
  tl.add(cardsA, { opacity: [0, 1], y: reduce ? [0, 0] : [24, 0], delay: stagger(C * 0.04), duration: C * 0.14 }, at(5, 0.15));
  tl.add(cardsA[0], { scale: reduce ? [1, 1] : [1, 1.9], x: reduce ? 0 : "52%", y: reduce ? 0 : "50%", zIndex: 5, duration: C * 0.14 }, at(5, 0.35));
  tl.add($("[data-exchange]"), { opacity: [0, 1], duration: C * 0.1 }, at(5, 0.4));
  tl.add($("[data-token]"), { x: ["0%", "100%"], y: reduce ? [0, 0] : [0, -24, 0], duration: C * 0.2, ease: "inOut(3)" }, at(5, 0.45));
  tl.add(cardsA[0], { scale: 1, x: 0, y: 0, duration: C * 0.12 }, at(5, 0.62));
  tl.add($("[data-exchange]"), { opacity: 0, duration: C * 0.1 }, at(5, 0.7));
  tl.add(market.querySelector("[data-m='a']")!, { x: reduce ? "0%" : "-110%", opacity: 0, duration: C * 0.15 }, at(5, 0.72));
  tl.add(market.querySelector("[data-m='b']")!, { x: reduce ? ["0%", "0%"] : ["110%", "0%"], opacity: [0, 1], duration: C * 0.15 }, at(5, 0.72));

  // 07 Rewards: EcoCreds climb, badges pop, a reward unlocks with a small burst, the character dresses up.
  pose(6, 0, { rotateY: 360, rotateZ: 0, x: side, scale: mobile ? 0.74 : 1.04 }, C * 0.3);
  swap("market", "rewards", at(6, 0.05), C * 0.2);
  const rewards = scr("rewards");
  counters(rewards, at(6, 0.15), C * 0.35);
  tl.add(Array.from(rewards.querySelectorAll("[data-badge]")), { scale: reduce ? [1, 1] : [0, 1], opacity: [0, 1], delay: stagger(C * 0.05), duration: C * 0.12, ease: "out(3)" }, at(6, 0.22));
  tl.add(rewards.querySelector("[data-r='lock']")!, { opacity: 0, scale: reduce ? 1 : 0.6, duration: C * 0.08 }, at(6, 0.5));
  tl.add(rewards.querySelector("[data-r='prize']")!, { opacity: [0, 1], scale: reduce ? [1, 1] : [0.6, 1], duration: C * 0.1, ease: "out(3)" }, at(6, 0.52));
  if (!reduce) tl.add(Array.from(rewards.querySelectorAll("[data-spark]")), {
    opacity: [{ to: 1, duration: C * 0.02 }, { to: 0, duration: C * 0.12 }],
    x: (_?: unknown, i = 0) => Math.cos((i / 8) * Math.PI * 2) * 34, y: (_?: unknown, i = 0) => Math.sin((i / 8) * Math.PI * 2) * 22, duration: C * 0.14, ease: "out(3)",
  }, at(6, 0.52));
  tl.add(rewards.querySelector("[data-av='a']")!, { opacity: 0, duration: C * 0.1 }, at(6, 0.7));
  tl.add(rewards.querySelector("[data-av='b']")!, { opacity: [0, 1], scale: reduce ? [1, 1] : [0.7, 1], duration: C * 0.12, ease: "out(3)" }, at(6, 0.7));

  // 08 Roles: the phone steps aside and flips through six personalised dashboards.
  pose(7, 0, { x: mobile ? "0vw" : "10vw", y: mobile ? "-11vh" : "0vh", rotateY: reduce ? 360 : 352, scale: mobile ? 0.6 : 1 }, C * 0.3);
  const roles = ["student", "parent", "teacher", "community", "cadmin", "admin"];
  const labels = $$("[data-role-label]");
  roles.forEach((r, i) => {
    const t = at(7, 0.1 + i * 0.13);
    swap(i ? `role-${roles[i - 1]}` : "rewards", `role-${r}`, t, C * 0.08);
    tl.add(labels[i], { opacity: [0.35, 1], x: reduce ? [0, 0] : [0, 6], duration: C * 0.06 }, t);
    if (i) tl.add(labels[i - 1], { opacity: 0.35, x: 0, duration: C * 0.06 }, t);
  });

  // 09 Bigger impact: the phone recedes and the world grows in around it.
  pose(8, 0, { x: "0vw", y: mobile ? "-12vh" : "-4vh", rotateY: 360, scale: mobile ? 0.42 : 0.5, opacity: 0.9 }, C * 0.5);
  tl.add($("[data-bg='nature']"), { opacity: [0, 1], scale: reduce ? [1, 1] : [1.15, 1], duration: C * 0.5 }, at(8, 0.05));
  if (!reduce) tl.add($$("[data-leafbg]"), { rotate: (_?: unknown, i = 0) => [i % 2 ? -14 : 12, 0], scale: [0.7, 1], delay: stagger(C * 0.05), duration: C * 0.5, ease: "out(2)" }, at(8, 0.05));
  tl.add($("[data-bg='glow']"), { scale: reduce ? 1 : 1.8, opacity: 0.7, duration: C * 0.5 }, at(8, 0.05));

  // 10 Final call to action: the phone returns, the logo lands above it, the buttons come alive.
  pose(9, 0, { y: mobile ? "-6vh" : "6vh", scale: mobile ? 0.5 : 0.62, opacity: 1 }, C * 0.4);
  tl.add($("[data-bg='nature']"), { opacity: 0.45, duration: C * 0.3 }, at(9, 0.1));
  tl.add($("[data-final-logo]"), { opacity: [0, 1], y: reduce ? [0, 0] : [20, 0], duration: C * 0.25 }, at(9, 0.15));
  tl.add(cta, { opacity: [0, 1], y: reduce ? [0, 0] : [16, 0], duration: C * 0.2 }, at(9, 0.4));
  tl.add({}, { duration: 1 }, at(10)); // pin the end of the timeline to the end of chapter 10

  return tl;
}
