// Botanical leaf geometry (viewBox 0 0 200 270): blade outline, petiole, midrib and branching
// veins, all derived from one blade-width function so veins always end inside the margin.
// Each vein carries a slot on the sap timeline g∈[0,1]: start = when sap reaches it, len = how
// long it takes to fill. The UI lights each vein by clamp((g - start) / len).

export const CX = 100;
const BASE_Y = 214; // where blade meets petiole
const TIP_Y = 14;
const HEIGHT = BASE_Y - TIP_Y;
const MAX_HALF_WIDTH = 72;

const PETIOLE = { start: 0, len: 0.07 };
const MIDRIB = { start: 0.07, len: 0.83 }; // sap reaches the tip at g = 0.9
const MIDRIB_TOP_S = 0.97;
const LATERAL_LEN = 0.12;
const BRANCH_LEN = 0.07;
const MARGIN = { start: 0.92, len: 0.08 }; // outline lights last: the "full leaf" moment

export type Vein = { d: string; start: number; len: number; width: number; kind: "petiole" | "midrib" | "lateral" | "branch" | "margin" };

const r = (n: number) => Math.round(n * 10) / 10;
const yAt = (s: number) => BASE_Y - s * HEIGHT;
// Ovate blade: broad rounded base, widest ~40% up, tapering to a pointed apex.
export const halfWidth = (s: number) => (s <= 0 || s >= 1 ? 0 : MAX_HALF_WIDTH * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85));
const midribX = (s: number) => CX + 1.6 * Math.sin(Math.PI * s);
const sapAt = (s: number) => MIDRIB.start + MIDRIB.len * (s / MIDRIB_TOP_S);

// Margin points from base (s=0) to tip (s=1) on one side.
const sidePoints = (sign: 1 | -1) => Array.from({ length: 60 }, (_, i) => i / 59).map((s) => `${r(CX + sign * halfWidth(s))},${r(yAt(s))}`);

function quadPoint(p0: number[], c: number[], p1: number[], t: number) {
  const k = 1 - t;
  return [k * k * p0[0] + 2 * k * t * c[0] + t * t * p1[0], k * k * p0[1] + 2 * k * t * c[1] + t * t * p1[1]];
}

// A secondary vein leaves the midrib at ~45°, bows gently outward and stops short of the
// margin; near its end it forks like the reference drawing (two forks on the broad lower veins).
function lateral(s: number, sign: 1 | -1, big: boolean): Vein[] {
  const start = sapAt(s);
  const sEnd = Math.min(0.93, s + 0.12);
  const p0 = [midribX(s), yAt(s)];
  const p1 = [CX + sign * 0.78 * halfWidth(sEnd), yAt(sEnd)];
  // Control point sits between the ends (never beyond them), so the vein bows instead of looping.
  const c = [p0[0] + 0.6 * (p1[0] - p0[0]), p0[1] + 0.2 * (p1[1] - p0[1])];
  const veins: Vein[] = [{ d: `M${r(p0[0])},${r(p0[1])} Q${r(c[0])},${r(c[1])} ${r(p1[0])},${r(p1[1])}`, start, len: LATERAL_LEN, width: big ? 2 : 1.6, kind: "lateral" }];
  const forks: [number, number, number][] = big ? [[0.62, -0.05, 0.9], [0.38, 0.1, 0.55]] : [[0.62, -0.04, 0.88]];
  for (const [t, ds, reach] of forks) {
    const [bx, by] = quadPoint(p0, c, p1, t);
    const sb = Math.min(0.95, (BASE_Y - by) / HEIGHT + ds + 0.06);
    // Fork end: toward the margin (ds<0, a little lower) or up between veins (ds>0).
    const end = [bx + (CX + sign * reach * halfWidth(sb) - bx) * (ds < 0 ? 1 : 0.5), yAt(sb)];
    veins.push({ d: `M${r(bx)},${r(by)} L${r(end[0])},${r(end[1])}`, start: start + t * LATERAL_LEN, len: BRANCH_LEN, width: 1.1, kind: "branch" });
  }
  return veins;
}

export function buildLeaf() {
  const right = sidePoints(1);
  const left = sidePoints(-1);
  const blade = `M${[...right, ...[...left].reverse()].join(" L")} Z`;
  const petiole = `M${CX - 9},266 C${CX - 5},250 ${CX - 1},236 ${CX},${BASE_Y}`;
  const midribPts = Array.from({ length: 30 }, (_, i) => (i / 29) * MIDRIB_TOP_S).map((s) => `${r(midribX(s))},${r(yAt(s))}`);
  const lateralLevels = [0.07, 0.16, 0.25, 0.34, 0.43, 0.52, 0.61, 0.7];
  const veins: Vein[] = [
    { d: petiole, ...PETIOLE, width: 4, kind: "petiole" },
    { d: `M${midribPts.join(" L")}`, ...MIDRIB, width: 3.2, kind: "midrib" },
    ...lateralLevels.flatMap((s, i) => [...lateral(s, -1, i < 4), ...lateral(s + 0.045, 1, i < 4)]),
    { d: `M${right.join(" L")}`, ...MARGIN, width: 1.4, kind: "margin" },
    { d: `M${left.join(" L")}`, ...MARGIN, width: 1.4, kind: "margin" },
  ];
  return { blade, veins };
}

export const veinFill = (g: number, v: Pick<Vein, "start" | "len">) => Math.max(0, Math.min(1, (g - v.start) / v.len));
