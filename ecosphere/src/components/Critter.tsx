// Character avatars assembled from parts: "c:<body>-<colour>-<eyes>-<mouth>-<extra>".
// Legacy emoji avatars map to a stable character, so every existing account gets one.
export const PART_COUNTS = [4, 8, 5, 4, 5] as const;
export const AVATAR_RE = /^c:[0-3]-[0-7]-[0-4]-[0-3]-[0-4]$/;

// [background, body, shade]
const COLOURS = [
  ["#ffd9a8", "#ff9f4a", "#e07f2c"], ["#cdeee0", "#3fbf8f", "#2b9c71"], ["#d8dcff", "#6f7dff", "#5361e0"], ["#ffd3de", "#ff6f91", "#e04f73"],
  ["#fff1b8", "#ffcb3d", "#e0a915"], ["#d6f0ff", "#3fb2ff", "#1f92df"], ["#e9d9ff", "#a874ff", "#8a55e6"], ["#d9f5b8", "#8bd450", "#6db336"],
] as const;

const BODIES = [
  "M50 24c17 0 28 13 28 31 0 17-12 29-28 29S22 72 22 55c0-18 11-31 28-31z", // blob
  "M50 18c14 0 23 11 23 27v22c0 11-9 19-23 19s-23-8-23-19V45c0-16 9-27 23-27z", // bean
  "M24 52c0-18 11-30 26-30s26 12 26 30v32l-6-5-7 6-6-6-7 6-7-6-7 6-6-6-6 5z", // ghost
  "M27 34 25 16l15 10c3-1 7-1 10-1s7 0 10 1l15-10-2 18c4 6 5 12 5 18 0 18-12 32-28 32S22 70 22 52c0-6 1-12 5-18z", // eared
];

const EYES = [
  <g key="e1"><circle cx="41" cy="50" r="4" /><circle cx="59" cy="50" r="4" /></g>,
  <g key="e2"><path d="M36 51q5-6 10 0M54 51q5-6 10 0" fill="none" stroke="#1b1f1c" strokeWidth="3" strokeLinecap="round" /></g>,
  <g key="e3"><circle cx="41" cy="49" r="6.5" fill="#fff" /><circle cx="59" cy="49" r="6.5" fill="#fff" /><circle cx="42" cy="50" r="3.6" /><circle cx="60" cy="50" r="3.6" /><circle cx="43.3" cy="48.6" r="1.2" fill="#fff" /><circle cx="61.3" cy="48.6" r="1.2" fill="#fff" /></g>,
  <g key="e4"><circle cx="41" cy="50" r="4" /><path d="M54 51q5-5 10 0" fill="none" stroke="#1b1f1c" strokeWidth="3" strokeLinecap="round" /></g>,
  <g key="e5"><path d="M36 49h10M54 49h10" stroke="#1b1f1c" strokeWidth="3" strokeLinecap="round" /><path d="M37 49q4 4 8 0M55 49q4 4 8 0" fill="#1b1f1c" /></g>,
];

const MOUTHS = [
  <path key="m516" d="M43 61q7 7 14 0" fill="none" stroke="#1b1f1c" strokeWidth="3" strokeLinecap="round" />,
  <g key="m1"><path d="M42 59h16q-1 11-8 11t-8-11z" fill="#1b1f1c" /><path d="M46 66q4-3 8 0q-1 4-4 4t-4-4z" fill="#ff7a8f" /></g>,
  <ellipse key="m5247" cx="50" cy="63" rx="3.5" ry="4" fill="#1b1f1c" />,
  <path key="m5309" d="M42 60q4 5 8 0q4 5 8 0" fill="none" stroke="#1b1f1c" strokeWidth="3" strokeLinecap="round" />,
];

const EXTRAS: ((shade: string) => React.ReactNode)[] = [
  () => null,
  () => <><path d="M50 24v-8" stroke="#2f7d3a" strokeWidth="3" strokeLinecap="round" /><path d="M50 17c-8 0-11-5-11-10 7 0 11 4 11 10z" fill="#5cc26a" /><path d="M50 15c0-7 4-11 11-11 0 7-4 11-11 11z" fill="#7dd987" /></>,
  (s) => <><path d="M42 26 36 12M58 26l6-14" stroke={s} strokeWidth="3" strokeLinecap="round" /><circle cx="36" cy="11" r="4" fill={s} /><circle cx="64" cy="11" r="4" fill={s} /></>,
  () => <><path d="M27 38c2-14 11-22 23-22s21 8 23 22z" fill="#2d3a8c" /><path d="M26 38h48" stroke="#1f2a6b" strokeWidth="5" strokeLinecap="round" /><circle cx="50" cy="14" r="4" fill="#ff6f91" /></>,
  () => <><path d="M24 50c0-20 12-31 26-31s26 11 26 31" fill="none" stroke="#2b2f2c" strokeWidth="4" /><rect x="17" y="44" width="10" height="16" rx="5" fill="#2b2f2c" /><rect x="73" y="44" width="10" height="16" rx="5" fill="#2b2f2c" /></>,
];

const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.codePointAt(0)!) >>> 0, 7);
export function partsOf(avatar: string): number[] {
  if (AVATAR_RE.test(avatar)) return avatar.slice(2).split("-").map(Number);
  const h = hash(avatar || "?");
  return PART_COUNTS.map((n, i) => Math.floor(h / [1, 4, 32, 160, 640][i]) % n);
}
export const randomAvatar = () => `c:${PART_COUNTS.map((n) => Math.floor(Math.random() * n)).join("-")}`;
export const AVATAR_PRESETS = ["c:0-1-2-1-1", "c:3-0-0-0-0", "c:2-6-1-3-0", "c:1-5-3-0-3", "c:0-3-4-2-4", "c:3-4-2-1-2", "c:1-7-0-3-1", "c:2-2-2-0-0", "c:0-0-1-1-3", "c:3-5-4-0-1"];

export function Critter({ avatar, size = 40, background, className = "" }: { avatar: string; size?: number; background?: string; className?: string }) {
  const [b, c, e, m, x] = partsOf(avatar);
  const [bg, body, shade] = COLOURS[c];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 rounded-full ${className}`} aria-hidden style={{ background: background ?? bg }}>
      <ellipse cx="50" cy="90" rx="24" ry="4" fill="#000" opacity=".12" />
      {x === 2 && EXTRAS[2](shade)}
      <path d={BODIES[b]} fill={body} />
      <path d={BODIES[b]} fill={shade} opacity=".35" style={{ clipPath: "inset(62% 0 0 0)" }} />
      <ellipse cx="38" cy="36" rx="6" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-25 38 36)" />
      <g fill="#1b1f1c">{EYES[e]}</g>
      <circle cx="34" cy="60" r="4" fill="#ff8aa5" opacity=".55" /><circle cx="66" cy="60" r="4" fill="#ff8aa5" opacity=".55" />
      {MOUTHS[m]}
      {x !== 2 && EXTRAS[x](shade)}
    </svg>
  );
}
