import { createCarScene } from './scene.js';
import { buildTimeline, createState, CHAPTER_COUNT, SPAN } from './timeline.js';
import { CALLOUTS, ROSTER, TELEMETRY, tracePath } from './content.js';

const RAIL = ['Reveal', 'Aero', 'Chassis', 'Sidepods', 'Rear', 'Blueprint', 'Team', 'Telemetry', 'Final'];
const BLUEPRINT = 5;
const PLATEAU = 70; // a chapter's camera state is settled this far into its span

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduce', reduce);

const $ = (sel) => document.querySelector(sel);
const journey = $('#journey');
const canvas = $('#car');
const chapters = [...document.querySelectorAll('.chapter')];
const drag = $('#drag-layer');
const detail = $('#detail');
const state = createState();
let current = -1;

// ---------- static content ----------
function renderRoster() {
  $('#roster').innerHTML = ROSTER.map((r) => `
    <div class="role">
      <p class="title">${r.role}</p>
      <p class="name">Name TBC</p>
      <p class="focus">${r.focus}</p>
    </div>`).join('');
}

function renderTelemetry() {
  const { width, height, series } = TELEMETRY;
  const rows = [0.25, 0.5, 0.75].map((f) => {
    const y = 14 + f * (height - 28);
    return `<line class="axis" x1="14" x2="${width - 14}" y1="${y}" y2="${y}"/>`;
  }).join('');
  const paths = series.map((s) => `<path class="trace ${s.className}" d="${tracePath(s.values, width, height)}"/>`).join('');
  const keyColours = { speed: '#d8b66b', downforce: '#2fbf7a', tyre: '#e9ecf1' };
  const keys = series.map((s, i) => `<text class="legend" x="14" y="${height - 6 - (series.length - 1 - i) * 13}" fill="${keyColours[s.key]}">${s.label}</text>`).join('');
  $('#telemetry').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Illustrative telemetry traces: sector speed, downforce and tyre degradation">${rows}${paths}${keys}</svg>`;
}

function renderRail() {
  $('#rail-ticks').innerHTML = RAIL.map((label, i) =>
    `<li data-i="${i}" title="${label}">${String(i + 1).padStart(2, '0')}</li>`).join('');
}

// Floating callouts. Each one is projected from its 3D part every frame.
const callouts = CALLOUTS.map((c) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'callout';
  el.innerHTML = `<span class="dot"></span><span class="card"><b>${c.label}</b><span>${c.note}</span></span>`;
  el.addEventListener('click', () => openDetail(c));
  $('#callouts').append(el);
  return { ...c, el };
});

function openDetail(c) {
  if (current !== BLUEPRINT) return;
  $('#detail-kicker').textContent = 'Engineering note';
  $('#detail-title').textContent = c.label;
  $('#detail-body').textContent = c.detail;
  detail.hidden = false;
}
detail.querySelector('.detail-close').addEventListener('click', () => { detail.hidden = true; });

// ---------- scroll progress -> chapter ----------
function onProgress(p) {
  const idx = Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(p * CHAPTER_COUNT)));
  $('#rail-fill').style.height = `${Math.round(p * 100)}%`;
  if (idx === current) return;
  current = idx;
  chapters.forEach((el, i) => el.classList.toggle('is-active', i === idx));
  document.querySelectorAll('.rail-ticks li').forEach((li, i) => li.classList.toggle('on', i === idx));
  drag.classList.toggle('on', idx === BLUEPRINT);
  if (idx !== BLUEPRINT) detail.hidden = true;
}

function goTo(i) {
  const max = journey.offsetHeight - window.innerHeight;
  const y = journey.offsetTop + (max * (i * SPAN + PLATEAU)) / (CHAPTER_COUNT * SPAN);
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}
document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => goTo(Number(btn.dataset.go)));
});

// ---------- boot ----------
renderRoster();
renderTelemetry();
renderRail();

const car = await createCarScene(canvas, 'assets/car.glb');
const { scrub, seekChapter } = buildTimeline({ state, journey, chapters });

// Chapter index, rail and callouts follow the native scroll position directly.
// Anime.js drives the tweens (scroll-synced timeline); this just tracks where we are.
const progressFromScroll = () => {
  const top = journey.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, -top / (journey.offsetHeight - window.innerHeight)));
};
window.addEventListener('scroll', () => {
  const p = progressFromScroll();
  onProgress(p);
  // Reduced motion: no continuous scrub, each chapter snaps to its settled pose.
  if (reduce) seekChapter(Math.min(CHAPTER_COUNT - 1, Math.floor(p * CHAPTER_COUNT)));
}, { passive: true });

// Drag to orbit in the blueprint chapter.
let dragging = false;
let lastX = 0;
let lastY = 0;
drag.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  drag.classList.add('dragging');
  drag.setPointerCapture(e.pointerId);
});
drag.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  state.dragTheta += (e.clientX - lastX) * 0.006;
  state.dragPhi = Math.min(0.5, Math.max(-0.5, state.dragPhi - (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = () => { dragging = false; drag.classList.remove('dragging'); };
drag.addEventListener('pointerup', endDrag);
drag.addEventListener('pointercancel', endDrag);

// Place each callout over its part, and show it in the chapters it belongs to.
function placeCallouts() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const c of callouts) {
    const p = car.anchor(c.part).project(car.camera);
    c.el.style.transform = `translate3d(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px, 0)`;
    const on = c.ch.includes(current);
    c.el.classList.toggle('is-on', on);
    c.el.classList.toggle('is-hot', on && current === BLUEPRINT);
  }
}

function frame(now) {
  if (!reduce) scrub();
  car.update(state, now / 1000);
  placeCallouts();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => car.resize());
onProgress(progressFromScroll());
requestAnimationFrame(frame);
