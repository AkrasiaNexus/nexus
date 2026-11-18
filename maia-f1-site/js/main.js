import { animate, onScroll, stagger } from 'animejs';
import { createCarScene } from './scene.js';
import { CHAPTERS, chapterAt, chapterCentre, createChapterText, poseAt, smooth } from './story.js';
import { createConstellation } from './overlay.js';
import { drawPleiades } from './sky.js';
import { CONSTELLATION, ENVELOPE, ITERATIONS, TEAM, TIERS } from './content.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
document.documentElement.classList.toggle('reduce', reduce);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const track = $('[data-track]');
const canvas = $('#car');

// ---------- chapter panels (cards carry data-deal so the timeline deals them in) ----------
const maxTotal = Math.max(...ITERATIONS.map((m) => m.total));
const maxDrag = Math.max(...ITERATIONS.map((m) => m.drag));
$('#iteration-list').innerHTML = ITERATIONS.map((m) => `
  <article class="iteration${m.chosen ? ' is-chosen' : ''}" data-deal>
    <header><h3>${m.name}</h3>${m.chosen ? '<span class="chip">Selected</span>' : ''}</header>
    <dl>
      <div><dt>Total downward force</dt><dd><b>${m.total}</b> N</dd><i class="meter" style="--w:${(m.total / maxTotal).toFixed(3)}"></i></div>
      <div><dt>Drag</dt><dd><b>${m.drag}</b> N</dd><i class="meter meter-drag" style="--w:${(m.drag / maxDrag).toFixed(3)}"></i></div>
      <div><dt>Downforce</dt><dd><b>${m.downforce}</b> N</dd></div>
    </dl>
    <p>${m.verdict}</p>
  </article>`).join('');

const initials = (name) => name.split(' ').filter((_, i, a) => i === 0 || i === a.length - 1).map((w) => w[0]).join('');
$('#team-list').innerHTML = TEAM.map((m) => `
  <article class="member" data-deal>
    <span class="monogram" aria-hidden="true">${initials(m.name)}</span>
    <div>
      <h3>${m.name}</h3>
      <p class="roles">${m.roles.join(' · ')}</p>
      <p class="does">${m.does}</p>
    </div>
  </article>`).join('');

$('#tier-list').innerHTML = TIERS.map((t) => `
  <article class="tier${t.featured ? ' is-featured' : ''}" data-deal>
    <h3>${t.name}</h3>
    <p class="price">${t.price}</p>
    <p class="covers">${t.covers}</p>
    <ul>${t.gets.map((g) => `<li>${g}</li>`).join('')}</ul>
  </article>`).join('');

$('#readouts').innerHTML = ENVELOPE.map((r) => `
  <div><dt>${r.label}</dt><dd><b data-count>${(0).toFixed(r.decimals)}</b> ${r.unit}</dd></div>`).join('');

// ---------- the Pleiades ----------
const skyEl = $('#sky');
const sky = drawPleiades(skyEl);
if (!reduce) {
  animate(sky.stars, { opacity: [0, 1], duration: 900, delay: stagger(110, { start: 500, from: 3 }), ease: 'outQuad' });
  animate(sky.lines, { opacity: [0, 0.55], duration: 700, delay: stagger(90, { start: 1200 }), ease: 'outQuad' });
}

// In the Why MAIA chapter the sky glides to the centre and grows. Measure its resting box once (and on resize).
let skyHome = null;
const measureSky = () => {
  skyEl.style.transform = '';
  const r = skyEl.getBoundingClientRect();
  skyHome = { x: r.left, y: r.top, w: r.width };
};
function placeSky(focus) {
  if (!skyHome) measureSky();
  const phone = innerWidth < 761;
  const w = phone ? innerWidth * 0.96 : Math.min(innerWidth * 0.62, 940);
  const cx = phone ? innerWidth / 2 : innerWidth * 0.66;
  const cy = phone ? innerHeight * 0.3 : innerHeight * 0.48;
  const h = (w * 640) / 1040; // the sky's aspect ratio (its viewBox)
  const s = 1 + (w / skyHome.w - 1) * focus;
  const tx = (cx - w / 2 - skyHome.x) * focus;
  const ty = (cy - h / 2 - skyHome.y) * focus;
  skyEl.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
}

// ---------- the story ----------
const chapters = $$('.chapter', track);
const seekText = createChapterText(chapters, reduce);
const constellation = createConstellation($('#constellation'), CONSTELLATION);
const counters = $$('[data-count]');
const cta = $('.final-cta');
const hudIndex = $('#hud-index');
const hudName = $('#hud-name');

// anime.js Scroll Observer: where the reader is within the pinned track.
const scroll = onScroll({ target: track, enter: 'top top', leave: 'bottom bottom' });

// Every [data-go] link jumps to the centre of its chapter.
const goTo = (i) => {
  const top = track.getBoundingClientRect().top + scrollY;
  scrollTo({ top: top + chapterCentre(i) * (track.offsetHeight - innerHeight), behavior: reduce ? 'instant' : 'smooth' });
};
$$('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(+a.dataset.go); }));

const car = await createCarScene(canvas, 'assets/car.glb');
document.documentElement.classList.add('is-ready');

const state = {};
let eased = scroll.progress;
let last = performance.now();
const loadedAt = last;
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
if (finePointer && !reduce) {
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / innerWidth - 0.5;
    pointer.y = e.clientY / innerHeight - 0.5;
  }, { passive: true });
}

let shownChapter = -1;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // Eased scrub: the car glides to the scroll position. Reduced motion follows it directly.
  eased = reduce ? scroll.progress : eased + (scroll.progress - eased) * (1 - Math.exp(-dt * 7));

  poseAt(eased, state, reduce);
  // The hook: the studio lights come up over the first 1.6 s, and the key light follows a fine pointer.
  state.light = 0.2 + 0.85 * smooth(0, 1600, now - loadedAt);
  pointer.sx += (pointer.x - pointer.sx) * 0.06;
  pointer.sy += (pointer.y - pointer.sy) * 0.06;
  state.keyAngle += pointer.sx * 0.9;
  state.phi += pointer.sy * 0.04;

  car.frame(state, now / 1000);
  constellation(car.project, state.constellation);
  skyEl.style.opacity = state.sky.toFixed(3);
  placeSky(state.skyFocus);
  seekText(eased);

  counters.forEach((node, i) => {
    const r = ENVELOPE[i];
    const text = (r.value * state.envelope).toFixed(r.decimals);
    if (node.textContent !== text) node.textContent = text;
  });

  const live = eased > chapterCentre(CHAPTERS.length - 1) - 0.02; // final buttons only clickable once on screen
  if (cta.inert === live) cta.inert = !live;

  const ch = chapterAt(eased);
  if (ch !== shownChapter) {
    shownChapter = ch;
    hudIndex.textContent = String(ch + 1).padStart(2, '0');
    hudName.textContent = CHAPTERS[ch].name;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Resizing changes the track height; keep the reader in the same chapter.
let resizeTimer;
addEventListener('resize', () => {
  const p = eased;
  car.resize();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    measureSky();
    const top = track.getBoundingClientRect().top + scrollY;
    const inside = scrollY >= top && scrollY <= top + track.offsetHeight - innerHeight;
    if (inside) scrollTo({ top: top + p * (track.offsetHeight - innerHeight), behavior: 'instant' });
  }, 120);
});

// QA hook for the scripts in qa/ (read-only).
window.__hermes = { progress: () => eased, target: () => scroll.progress, state };
