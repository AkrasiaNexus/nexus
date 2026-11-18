import { onScroll } from 'animejs';
import { createCarScene } from './scene.js';
import { BEATS, createStoryText, drawTelemetryOnEnter, stateAt } from './story.js';
import { ROSTER, TELEMETRY, tracePath } from './content.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduce', reduce);

const stage = document.querySelector('#story');
const canvas = document.querySelector('#car');

// ---------- static sections ----------
document.querySelector('#roster').innerHTML = ROSTER.map((r) => `
  <div class="role">
    <p class="title">${r.role}</p>
    <p class="name">Name TBC</p>
    <p class="focus">${r.focus}</p>
  </div>`).join('');

function renderChart() {
  const { width, height, series } = TELEMETRY;
  const rows = [0.25, 0.5, 0.75].map((f) => {
    const y = 16 + f * (height - 32);
    return `<line class="axis" x1="16" x2="${width - 16}" y1="${y}" y2="${y}"/>`;
  }).join('');
  const paths = series.map((s) => `<path class="trace" stroke="${s.colour}"${s.dashed ? ' stroke-dasharray="2 6"' : ''} d="${tracePath(s.values, width, height)}"/>`).join('');
  const key = series.map((s) => `<li><i style="background:${s.colour}"></i>${s.label}</li>`).join('');
  document.querySelector('#chart').innerHTML = `
    <ul class="key">${key}</ul>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Illustrative telemetry traces">${rows}${paths}</svg>`;
}
renderChart();
drawTelemetryOnEnter(document.querySelector('#telemetry'));

// ---------- the story ----------
const beatEls = [...document.querySelectorAll('.beat')];
const text = createStoryText(beatEls);
// anime.js Scroll Observer: where the reader is within the pinned stage.
const scroll = onScroll({ target: stage, enter: 'top top', leave: 'bottom bottom' });
const car = await createCarScene(canvas, 'assets/car.glb');

const state = { shift: 0.2, lift: 0, explode: {} };
const CENTRES = BEATS.map((b) => (b.from + b.to) / 2);
const nearestBeat = (p) => CENTRES.reduce((best, c) => (Math.abs(c - p) < Math.abs(best - p) ? c : best));

// Eased scrub: the car glides toward the scroll position instead of snapping to it.
let eased = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (reduce) {
    // No continuous scrub: the car steps between beat poses.
    eased = nearestBeat(scroll.progress);
  } else {
    eased += (scroll.progress - eased) * (1 - Math.exp(-dt * 7));
  }
  stateAt(eased, state);
  text.seek(eased);
  car.update(state, now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => car.resize());
