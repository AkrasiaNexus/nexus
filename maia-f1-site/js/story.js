import { animate, createTimeline, splitText, stagger, svg } from 'animejs';
import { PART_NAMES } from './scene.js';

// One continuous story over the pinned stage, progress p in 0..1.
// The car is the signature object: its camera orbit, its explode and its
// blueprint lines are all functions of p, so scrolling back reverses everything.

const PI2 = Math.PI * 2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Camera keys: p, orbit theta (0 = nose-on, PI/2 = right side), elevation phi, distance.
const CAM_KEYS = [
  { p: 0.0, th: 1.25, ph: 0.02, d: 4.6 },
  { p: 0.22, th: 1.1, ph: 0.04, d: 4.2 },
  { p: 0.34, th: 0.22, ph: 0.16, d: 2.9 },
  { p: 0.5, th: 1.0, ph: 0.1, d: 3.3 },
  { p: 0.64, th: 2.3, ph: 0.3, d: 3.5 },
  { p: 0.8, th: 0.85, ph: 0.3, d: 5.9 },
  { p: 0.92, th: 0.55, ph: 0.12, d: 4.0 },
  { p: 1.0, th: 0.55, ph: 0.12, d: 3.8 },
];

// Explode window per part: [start, end] in p. Parts fly out in build order.
const EXPLODE = {
  nose_cone: [0.22, 0.32], front_wing: [0.22, 0.34],
  halo: [0.4, 0.48], cockpit: [0.42, 0.5],
  sidepods_l: [0.44, 0.54], sidepods_r: [0.44, 0.54], floor: [0.46, 0.56],
  engine_cover: [0.56, 0.62],
  rear_pods_l: [0.6, 0.66], rear_pods_r: [0.6, 0.66],
  rear_wing: [0.6, 0.68], drs_flap: [0.64, 0.7],
  wheels_fl: [0.66, 0.74], wheels_fr: [0.66, 0.74], wheels_rl: [0.66, 0.74], wheels_rr: [0.66, 0.74],
};

// Text beats: [from, to] in p. The hero is the first beat and starts visible.
export const BEATS = [
  { from: 0.0, to: 0.14 },
  { from: 0.24, to: 0.38 },
  { from: 0.42, to: 0.54 },
  { from: 0.56, to: 0.66 },
  { from: 0.68, to: 0.76 },
  { from: 0.78, to: 0.86 },
  { from: 0.92, to: 1.0 },
];
const TOTAL = 1000; // timeline units; one unit per 0.001 of progress

function cameraAt(p) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1].p) i += 1;
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1];
  const t = smooth(a.p, b.p, p);
  return { theta: lerp(a.th, b.th, t), phi: lerp(a.ph, b.ph, t), dist: lerp(a.d, b.d, t) };
}

/** Fills `state` for progress p. Pure function of p, so it reverses cleanly. */
export function stateAt(p, state) {
  const cam = cameraAt(p);
  const assemble = 1 - smooth(0.86, 0.92, p);
  Object.assign(state, cam, {
    // the car sits right of the text, easing toward centre for the wide blueprint
    shift: lerp(0.2, 0.13, smooth(0.66, 0.8, p)),
    light: 0.4 + 0.6 * smooth(0, 0.12, p),
    sweep: smooth(0, 0.22, p),
    flow: smooth(0.24, 0.3, p) * (1 - smooth(0.4, 0.46, p)),
    blueprint: smooth(0.7, 0.76, p) * (1 - smooth(0.84, 0.9, p)),
    drs: smooth(0.64, 0.68, p) * (1 - smooth(0.8, 0.84, p)),
    spin: p > 0.92 ? ((p - 0.92) / 0.08) * PI2 : 0,
    dragTheta: 0,
    dragPhi: 0,
  });
  for (const name of PART_NAMES) {
    const w = EXPLODE[name];
    state.explode[name] = w ? smooth(w[0], w[1], p) * assemble : 0;
  }
  return state;
}

/**
 * anime.js timeline for the text beats. It is seeked to p, never played,
 * so the words reverse with the scroll.
 */
export function createStoryText(beatEls) {
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'outCubic' } });
  beatEls.forEach((el, i) => {
    const { from, to } = BEATS[i];
    const words = splitText(el.querySelector('h2'), { words: true }).words;
    if (i > 0) { // the hero is already on screen at the top of the page
      tl.add(el, { opacity: [0, 1], translateY: [28, 0], duration: 70 }, from * TOTAL);
      tl.add(words, { opacity: [0.12, 1], translateY: [12, 0], duration: 60, delay: stagger(12) }, from * TOTAL + 20);
    }
    if (i < beatEls.length - 1) tl.add(el, { opacity: 0, translateY: -20, duration: 60, ease: 'inCubic' }, (to * TOTAL) - 40);
  });
  // The last beat (final call) stays on screen to the end.
  const lamps = beatEls[beatEls.length - 1].querySelectorAll('.lights i');
  tl.add(lamps, { opacity: [0.12, 1], duration: 40, delay: stagger(40), ease: 'outQuad' }, 930);
  tl.add(lamps, { opacity: 0.12, duration: 60, delay: stagger(30), ease: 'inQuad' }, 975);
  tl.add({}, { duration: 1 }, TOTAL - 1);
  return {
    seek(p) {
      tl.seek(Math.min(1, Math.max(0, p)) * TOTAL);
    },
  };
}

/** Telemetry traces draw on when the section scrolls into view. */
export function drawTelemetryOnEnter(section) {
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    animate(svg.createDrawable('#telemetry .trace'), {
      draw: ['0 0', '0 1'], duration: 1800, ease: 'inOutQuart', delay: stagger(220),
    });
    io.disconnect();
  }, { threshold: 0.35 });
  io.observe(section);
}

