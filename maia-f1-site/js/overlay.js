// The constellation (chapter 07): the crest's four-point stars and dashed lines, pinned to the car's parts.
const NS = 'http://www.w3.org/2000/svg';
const STAR = 'M0-8C1.3-1.8 1.8-1.3 8 0 1.8 1.3 1.3 1.8 0 8-1.3 1.8-1.8 1.3-8 0-1.8-1.3-1.3-1.8 0-8Z';

const el = (tag, attrs, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.append(node);
  return node;
};

/** Builds the SVG once; returns update(project, k) to call every frame. */
export function createConstellation(svg, items) {
  const lines = items.slice(1).map(() => el('line', { class: 'c-line' }, svg));
  const stars = items.map((item, i) => {
    const g = el('g', { class: 'c-star' }, svg);
    el('path', { d: STAR, class: 'c-glyph' }, g);
    const name = el('text', { class: 'c-name', x: 14, y: i % 2 ? 22 : -12 }, g);
    name.textContent = item.name;
    const spec = el('text', { class: 'c-spec', x: 14, y: i % 2 ? 37 : 3 }, g);
    spec.textContent = item.spec;
    return g;
  });

  return function update(project, k) {
    svg.style.display = k > 0.005 ? '' : 'none';
    if (k <= 0.005) return;
    svg.setAttribute('viewBox', `0 0 ${svg.clientWidth} ${svg.clientHeight}`);
    const pts = items.map((item) => project(item.part));
    const n = items.length;
    stars.forEach((g, i) => {
      const p = pts[i];
      const t = Math.min(1, Math.max(0, k * n - i * 0.6)); // stars light one after another
      g.style.opacity = p ? t : 0;
      if (p) g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    });
    lines.forEach((line, i) => {
      const a = pts[i];
      const b = pts[i + 1];
      const t = Math.min(1, Math.max(0, k * n - i * 0.6 - 0.4)); // each line draws toward the next star
      if (!a || !b || t <= 0) { line.style.opacity = 0; return; }
      line.style.opacity = 1;
      line.setAttribute('x1', a.x.toFixed(1));
      line.setAttribute('y1', a.y.toFixed(1));
      line.setAttribute('x2', (a.x + (b.x - a.x) * t).toFixed(1));
      line.setAttribute('y2', (a.y + (b.y - a.y) * t).toFixed(1));
    });
  };
}
