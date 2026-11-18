import { createTimeline, onScroll, splitText, stagger, svg } from 'animejs';
import { PART_NAMES } from './scene.js';

export const CHAPTER_COUNT = 9;
export const SPAN = 100; // timeline units per chapter; the whole journey is 900 units
const TWEEN = 60; // units each camera or explode move takes
const LEAD = 10; // a move starts this long after its chapter begins
const PLATEAU = LEAD + TWEEN; // where a chapter's camera state is fully settled

// Camera orbit (theta, phi, dist), flags and explode sets accumulate by chapter.
// `shift` pushes the car away from the text column (text left -> car right).
const SHOTS = [
  { theta: 0.75, phi: 0.32, dist: 4.6, light: 1, sweep: 1, flow: 0, blueprint: 0, drs: 0, spin: 0, add: [] },
  { theta: 0.12, phi: 0.16, dist: 2.7, flow: 1, add: ['nose_cone', 'front_wing'] },
  { theta: 0.7, phi: 1.1, dist: 3.3, flow: 0, add: ['halo', 'cockpit'] },
  { theta: 1.57, phi: 0.06, dist: 3.2, add: ['sidepods_l', 'sidepods_r', 'floor'] },
  { theta: 2.5, phi: 0.42, dist: 3.4, drs: 1, add: ['rear_wing', 'drs_flap', 'rear_pods_l', 'rear_pods_r', 'wheels_fl', 'wheels_fr', 'wheels_rl', 'wheels_rr', 'engine_cover'] },
  { theta: 1.57, phi: 0.0, dist: 5.0, blueprint: 1, drs: 0, lift: 1, add: PART_NAMES.filter((n) => n !== 'monocoque') },
  { theta: 0.6, phi: 0.3, dist: 4.0, blueprint: 0, drs: 0, lift: 0, reset: true },
  { theta: 0.9, phi: 0.22, dist: 3.6, flow: 1, spin: Math.PI * 1.5, reset: true },
  { theta: 0.9, phi: 0.28, dist: 3.9, flow: 0.4, spin: Math.PI * 2, reset: true },
];

/** Full explode map (every part) for a set of parts that should be out. */
function explodeFor(active) {
  return Object.fromEntries(PART_NAMES.map((n) => [n, active.has(n) ? 1 : 0]));
}

/** Initial state: dark studio, car hidden (light 0), camera pulled back. */
export function createState() {
  return {
    theta: 0.75, phi: 0.32, dist: 5.6, shift: 0,
    light: 0, sweep: 0, flow: 0, blueprint: 0, drs: 0, spin: 0, lift: 0, end: 0,
    dragTheta: 0, dragPhi: 0,
    explode: explodeFor(new Set()),
  };
}

/**
 * Builds the single scroll-scrubbed timeline. Reduced-motion users get a
 * stepped version (see seekChapter) instead of a continuous scrub.
 */
export function buildTimeline({ state, journey, chapters }) {
  // The Scroll Observer reports progress through the journey; the timeline is seeked to it each frame.
  const observer = onScroll({ target: journey, enter: 'top top', leave: 'bottom bottom' });
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutSine' } });

  const active = new Set();
  SHOTS.forEach((shot, i) => {
    if (shot.reset) active.clear();
    (shot.add || []).forEach((n) => active.add(n));
    const at = i * SPAN + LEAD;
    const shift = i % 2 === 0 ? 0.14 : -0.14; // even chapters: text left, car right
    tl.add(state, {
      theta: shot.theta, phi: shot.phi, dist: shot.dist, shift,
      light: shot.light ?? 1, sweep: shot.sweep ?? 1,
      flow: shot.flow ?? 0, blueprint: shot.blueprint ?? 0, drs: shot.drs ?? 0, lift: shot.lift ?? 0,
      spin: shot.spin ?? 0,
      duration: TWEEN, ease: 'inOutCubic',
    }, at);
    tl.add(state.explode, { ...explodeFor(active), duration: TWEEN, ease: 'inOutCubic' }, at);
  });

  // Chapter text: fade in, fade out, and word-by-word headline reveal.
  chapters.forEach((el, i) => {
    tl.add(el, { opacity: [0, 1], translateY: [28, 0], duration: 16, ease: 'outCubic' }, i * SPAN);
    const words = splitText(el.querySelector('h2'), { words: true }).words;
    tl.add(words, { opacity: [0.1, 1], translateY: [14, 0], duration: 14, delay: stagger(3) }, i * SPAN + 6);
    if (i < CHAPTER_COUNT - 1) {
      tl.add(el, { opacity: 0, translateY: -22, duration: 14, ease: 'inCubic' }, i * SPAN + 86);
    }
  });

  // Telemetry traces draw on, chapter 7.
  const traces = svg.createDrawable('#telemetry .trace');
  tl.add(traces, { draw: ['0 0', '0 1'], duration: 56, ease: 'linear', delay: stagger(6) }, 7 * SPAN + 12);

  // Start lights come on, then go out, chapter 9.
  const lamps = chapters[8].querySelectorAll('.lights i');
  tl.add(lamps, { opacity: [0.12, 1], duration: 6, delay: stagger(5), ease: 'outQuad' }, 8 * SPAN + 14);
  tl.add(lamps, { opacity: 0.12, duration: 6, delay: stagger(2), ease: 'inQuad' }, 8 * SPAN + 58);

  // Pin the timeline to exactly 900 units so progress maps 1:1 to chapters.
  tl.add(state, { end: 1, duration: 1 }, CHAPTER_COUNT * SPAN - 1);

  return {
    /** Scrub the timeline to the observed scroll progress (0..1). */
    scrub() {
      tl.seek(observer.progress * CHAPTER_COUNT * SPAN);
    },
    /** Reduced motion: jump to a chapter's settled pose. */
    seekChapter(i) {
      tl.seek(i * SPAN + PLATEAU);
    },
  };
}
