import { animate, createTimeline, splitText, stagger } from 'animejs';

// The whole site is one story on one number: p, 0..1 through the pinned stage.
// Camera, car placement, sky and labels are pure functions of p, so a fast jump and a slow scroll
// land on the same frame, and scrolling back reverses everything.

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export const CHAPTER_NAMES = [
  'Reveal', 'Envelope', 'Front wing', 'Side pods', 'Rear', 'Constellation',
  'CFD', 'Team', 'Why MAIA', 'Partners', 'Lights out',
];
const N = CHAPTER_NAMES.length;
export const CHAPTERS = CHAPTER_NAMES.map((name, i) => ({ name, from: i / N, to: (i + 1) / N }));
export const chapterCentre = (i) => (i + 0.5) / N;
export const chapterAt = (p) => Math.min(N - 1, Math.max(0, Math.floor(p * N)));

// Poses at chapter centres (the turntable chapter has a start and an end).
// theta: 0 = looking at the nose, PI/2 = the car's right side (nose points right); it only ever keeps turning.
// shift: car left (-) or right (+) of centre, in screen widths. rise: car higher (+) or lower (-) in frame.
// car / sky: visibility of the car and the Pleiades.
const TURN = Math.PI * 2;
const at = (i, f = 0.5) => (i + f) / N;
const KEYS = [
  { p: 0, th: 0.9, ph: 0.22, d: 4.4, shift: 0.15, rise: 0, car: 1, sky: 1 },
  { p: at(0), th: 0.95, ph: 0.21, d: 4.3, shift: 0.15, rise: 0, car: 1, sky: 1 },
  { p: at(1), th: Math.PI / 2, ph: 0.05, d: 4.8, shift: 0.15, rise: 0, car: 1, sky: 0.15 },
  { p: at(2), th: 0.45, ph: 0.12, d: 4.7, shift: 0.15, rise: 0, car: 1, sky: 0.15 },
  { p: at(3), th: 1.2, ph: 0.1, d: 5.2, shift: 0.15, rise: 0, car: 1, sky: 0.15 },
  { p: at(4), th: 2.35, ph: 0.3, d: 4.8, shift: 0.15, rise: 0, car: 1, sky: 0.15 },
  { p: at(5, 0.12), th: 2.6, ph: 0.32, d: 4.2, shift: 0, rise: -0.06, car: 1, sky: 1 },
  { p: at(5, 0.88), th: 0.9 + TURN, ph: 0.26, d: 4.2, shift: 0, rise: -0.06, car: 1, sky: 1 },
  { p: at(6), th: 1.25 + TURN, ph: 0.2, d: 5.4, shift: -0.24, rise: 0, car: 1, sky: 0.15 },
  { p: at(7), th: 1.9 + TURN, ph: 0.42, d: 8.5, shift: 0, rise: 0.3, car: 0.85, sky: 0.3 },
  { p: at(8), th: 2.5 + TURN, ph: 0.3, d: 9.5, shift: 0.28, rise: -0.22, car: 0.4, sky: 1 },
  { p: at(9), th: 0.95 + 2 * TURN, ph: 0.2, d: 5.6, shift: -0.24, rise: 0, car: 1, sky: 0.2 }, // nose toward the tiers
  { p: at(10), th: 1.05 + 2 * TURN, ph: 0.16, d: 4.0, shift: 0.15, rise: 0, car: 1, sky: 0.7 },
  { p: 1, th: 1.1 + 2 * TURN, ph: 0.16, d: 4.0, shift: 0.15, rise: 0, car: 1, sky: 0.7 },
];
const FIELDS = ['th', 'ph', 'd', 'shift', 'rise', 'car', 'sky'];

function keyAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(a.p, b.p, p);
  return Object.fromEntries(FIELDS.map((f) => [f, lerp(a[f], b[f], t)]));
}

/** Fill `s` for progress p. Reduced motion keeps the camera still and only changes visibility. */
export function poseAt(p, s, reduce) {
  const k = keyAt(p);
  const still = reduce ? keyAt(0) : k;
  s.theta = still.th;
  s.phi = still.ph;
  s.dist = still.d;
  s.shift = reduce ? 0.15 : k.shift;
  s.rise = reduce ? 0 : k.rise;
  // Reduced motion: the car can't step aside, so it fades back behind the content chapters (CFD to Partners).
  const content = smooth(at(6, 0), at(6, 0.2), p) * (1 - smooth(at(9, 0.8), at(10, 0), p));
  s.car = reduce ? 1 - 0.8 * content : k.car;
  s.sky = k.sky;
  s.skyFocus = smooth(at(7, 0.7), at(8, 0.2), p) * (1 - smooth(at(8, 0.8), at(9, 0.3), p));
  s.flow = reduce ? 0 : smooth(at(2, 0.05), at(2, 0.3), p) * (1 - smooth(at(2, 0.75), at(2, 0.98), p));
  s.keyAngle = reduce ? 0.9 : 0.9 + p * 3;
  s.constellation = smooth(at(5, 0.1), at(5, 0.3), p) * (1 - smooth(at(5, 0.85), at(5, 1), p));
  s.envelope = smooth(at(1, 0.05), at(1, 0.4), p);
  return s;
}

const T = 1000; // timeline units for p = 0..1

/**
 * All chapter copy and panels on one anime.js timeline, seeked to p (never played).
 * Words reveal with a stagger, cards deal in, meters grow; each block leaves as ONE tween so a fast jump
 * always lands on its final frame.
 */
export function createChapterText(chapterEls, reduce) {
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'outCubic' } });
  const m = reduce ? 0 : 1; // no spatial motion when reduced
  const span = T / N;
  const heroWords = splitText(chapterEls[0].querySelector('h1'), { words: true }).words;

  chapterEls.forEach((el, i) => {
    const start = i * span;
    const end = (i + 1) * span;
    if (i > 0) {
      const words = splitText(el.querySelector('h2'), { words: true }).words;
      tl.add(el, { opacity: [0, 1], translateY: [24 * m, 0], duration: 30 }, start + 4);
      tl.add(words, { opacity: [0.08, 1], translateY: [14 * m, 0], duration: 22, delay: stagger(2.5) }, start + 6);
    }
    const cards = el.querySelectorAll('[data-deal]');
    if (cards.length) {
      tl.add(cards, { opacity: [0, 1], translateY: [26 * m, 0], scale: [1 - 0.04 * m, 1], duration: 18, delay: stagger(3) }, start + 12);
    }
    const meters = el.querySelectorAll('.meter');
    if (meters.length) tl.add(meters, { scaleX: [0, 1], duration: 22, delay: stagger(3), ease: 'outExpo' }, start + 18);
    if (i < chapterEls.length - 1) {
      tl.add(el, { opacity: 0, translateY: -18 * m, duration: 22, ease: 'inCubic' }, end - 24);
    }
  });

  const lamps = chapterEls[N - 1].querySelectorAll('.lamp');
  const last = (N - 1) * span;
  tl.add(lamps, { opacity: [0.14, 1], duration: 8, delay: stagger(7), ease: 'outQuad' }, last + 20);
  tl.add(lamps, { opacity: 0.14, duration: 6, ease: 'inQuad' }, last + 70);
  tl.add({}, { duration: 1 }, T - 1); // pin the end so the last chapter has room

  // The hook: the hero headline builds itself on load, before any scroll.
  animate(heroWords, {
    opacity: [0, 1], translateY: [reduce ? 0 : 26, 0], duration: reduce ? 400 : 900, delay: stagger(110, { start: 250 }), ease: 'outExpo',
  });

  // A single seek that jumps clean over a tween can leave the earlier tween's value on screen (reproduced:
  // 590 -> 682 left chapter 6 visible). Walk to the new time in small steps instead; skip when nothing changed.
  let current = 0;
  return (p) => {
    const target = Math.min(1, Math.max(0, p)) * T;
    const steps = Math.ceil(Math.abs(target - current) / 4);
    for (let i = 1; i <= steps; i += 1) tl.seek(current + ((target - current) * i) / steps);
    current = target;
  };
}
