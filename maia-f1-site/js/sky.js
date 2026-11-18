// The Pleiades, drawn from catalogue star positions (J2000, rounded), with Maia highlighted.
// The team crest is a constellation; only Maia is labelled.
const NS = 'http://www.w3.org/2000/svg';
const STAR = 'M0-8C1.3-1.8 1.8-1.3 8 0 1.8 1.3 1.3 1.8 0 8-1.3 1.8-1.8 1.3-8 0-1.8-1.3-1.3-1.8 0-8Z';

// name, RA (h, m, s), Dec (deg, arcmin, arcsec), visual magnitude
const STARS = [
  ['Alcyone', [3, 47, 29.1], [24, 6, 18], 2.87],
  ['Atlas', [3, 49, 9.7], [24, 3, 12], 3.62],
  ['Electra', [3, 44, 52.5], [24, 6, 48], 3.7],
  ['Maia', [3, 45, 49.6], [24, 22, 4], 3.87],
  ['Merope', [3, 46, 19.6], [23, 56, 54], 4.18],
  ['Taygeta', [3, 45, 12.5], [24, 28, 2], 4.3],
  ['Pleione', [3, 49, 11.2], [24, 8, 12], 5.05],
  ['Celaeno', [3, 44, 48.2], [24, 17, 22], 5.45],
  ['Asterope', [3, 45, 54.5], [24, 33, 16], 5.76],
];
// The dashed asterism, in the style of the crest.
const LINKS = [
  ['Pleione', 'Atlas'], ['Atlas', 'Alcyone'], ['Alcyone', 'Merope'], ['Alcyone', 'Maia'],
  ['Maia', 'Electra'], ['Electra', 'Celaeno'], ['Maia', 'Taygeta'], ['Taygeta', 'Asterope'],
];

const SCALE = 900; // svg units per degree of sky
const ra = ([h, m, s]) => 15 * (h + m / 60 + s / 3600);
const dec = ([d, m, s]) => d + m / 60 + s / 3600;
const RA0 = 56.72;
const DEC0 = 24.22;
const COS = Math.cos((DEC0 * Math.PI) / 180);

/** Star positions in svg units: east is left on the sky, north is up. */
const placed = STARS.map(([name, r, d, mag]) => ({
  name,
  mag,
  x: -(ra(r) - RA0) * COS * SCALE,
  y: -(dec(d) - DEC0) * SCALE,
}));

const el = (tag, attrs, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.append(node);
  return node;
};

/** Draws the Pleiades into an <svg>. Returns the star and line nodes so callers can animate them. */
export function drawPleiades(svg) {
  svg.setAttribute('viewBox', '-520 -330 1040 640');
  const byName = Object.fromEntries(placed.map((s) => [s.name, s]));
  const lines = LINKS.map(([a, b]) => el('line', {
    class: 'sky-line', x1: byName[a].x, y1: byName[a].y, x2: byName[b].x, y2: byName[b].y,
  }, svg));
  const stars = placed.map((s) => {
    const isMaia = s.name === 'Maia';
    const size = isMaia ? 2.6 : Math.max(0.7, 2.3 - (s.mag - 2.8) * 0.45); // brighter star, bigger glyph
    const g = el('g', { class: `sky-star${isMaia ? ' is-maia' : ''}`, transform: `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})` }, svg);
    if (isMaia) el('circle', { class: 'sky-halo', r: 34 }, g);
    el('path', { d: STAR, transform: `scale(${size.toFixed(2)})`, class: 'sky-glyph' }, g);
    if (isMaia) {
      const t = el('text', { class: 'sky-name', x: 14 + size * 6, y: 4 }, g);
      t.textContent = 'Maia';
    }
    return g;
  });
  return { stars, lines };
}
