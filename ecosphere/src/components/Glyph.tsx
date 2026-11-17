// One drawn icon family for items and waste types (replaces emoji): 48-unit grid, 2.2 stroke,
// round joins, plus a single flat accent shape per glyph.
const A = { fill: "var(--glyph-accent)", stroke: "none" } as const;

const GLYPHS: Record<string, React.ReactNode> = {
  bottle: <><path d="M20 5h8v6l3.5 4.5V40a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V15.5L20 11z" /><rect x="16.5" y="22" width="15" height="9" {...A} /><path d="M20 11h8" /></>,
  tote: <><path d="M9 18h30l-2.5 25h-25z" /><path d="M17 18v-4a7 7 0 0 1 14 0v4" /><circle cx="24" cy="31" r="5" {...A} /></>,
  plant: <><path d="M24 30V17" /><path d="M24 22c-7 0-10-4.5-10-9 6 0 10 3.5 10 9z" {...A} /><path d="M24 19c0-6.5 4-10 10-10 0 6-3.5 10-10 10z" {...A} /><path d="M12 30h24M14.5 30l2.5 13h14l2.5-13" /></>,
  books: <><rect x="9" y="33" width="30" height="9" rx="1.5" /><rect x="12" y="23" width="26" height="10" rx="1.5" /><rect x="10" y="13" width="27" height="10" rx="1.5" /><rect x="10" y="13" width="5" height="10" {...A} /><path d="M34 37h5M34 28h4" /></>,
  shirt: <><path d="M17 7 7.5 13l4.5 8 4-2v23h16V19l4 2 4.5-8L31 7c-1 3.5-3.5 5.5-7 5.5S18 10.5 17 7z" /><path d="M20 26h8v6h-8z" {...A} /></>,
  compost: <><rect x="12" y="7" width="24" height="6" rx="2" /><path d="M14 13h20v27a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M14 31h20v9a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" {...A} /><path d="M24 31v-7m0 3c-3 0-5-2-5-4.5 3 0 5 2 5 4.5z" /></>,
  cutlery: <><path d="M14 6v10a4.5 4.5 0 0 0 9 0V6M18.5 6v36" /><ellipse cx="32" cy="13" rx="5" ry="7" {...A} /><path d="M32 20v22" /></>,
  tree: <><circle cx="24" cy="19" r="12" {...A} /><path d="M24 23v19M18 28l6 4 6-6M16 42h16" /></>,
  box: <><path d="M24 6 41 14.5v19L24 42 7 33.5v-19z" /><path d="M7 14.5 24 23l17-8.5M24 23v19" /><path d="m15.5 10.2 17 8.5v6l-3.5-1.8v-6l-17-8.4z" {...A} /></>,
  teddy: <><circle cx="15" cy="12" r="4.5" {...A} /><circle cx="33" cy="12" r="4.5" {...A} /><circle cx="24" cy="18" r="9" /><path d="M15.5 27.5C12 30 11 34 11 38c0 3 3 5 13 5s13-2 13-5c0-4-1-8-4.5-10.5" /><path d="M22 20h4M21 16v.5M27 16v.5" /></>,
  chair: <><path d="M15 5v38M33 24v19M15 24h20M15 24l3 0" /><path d="M15 6h12v18H15z" {...A} /><path d="M15 31h18" /></>,
  bike: <><circle cx="12" cy="32" r="8" /><circle cx="36" cy="32" r="8" /><path d="M12 32l7-13h12l5 13M19 19l5 13h12M22 13h6" /><circle cx="24" cy="32" r="2.5" {...A} /></>,
  plug: <><path d="M18 5v8M30 5v8" /><path d="M13 13h22v9a11 11 0 0 1-22 0z" {...A} /><path d="M24 33v5a5 5 0 0 1-5 5h-6" /></>,
  backpack: <><path d="M14 16a10 10 0 0 1 20 0v24a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M19 9a5 5 0 0 1 10 0" /><rect x="18" y="27" width="12" height="9" rx="2" {...A} /></>,
  pan: <><circle cx="20" cy="27" r="13" /><circle cx="20" cy="27" r="7" {...A} /><path d="M32.5 22 44 13" /></>,
  jar: <><rect x="14" y="6" width="20" height="6" rx="2" /><path d="M15 12h18c2 2 3 4 3 7v20a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V19c0-3 1-5 3-7z" /><path d="M16 22h16v9H16z" {...A} /></>,
  can: <><ellipse cx="24" cy="9" rx="10" ry="3.5" /><path d="M14 9v30c0 2 4.5 3.5 10 3.5S34 41 34 39V9" /><path d="M14 18h20v13H14z" {...A} /></>,
  apple: <><path d="M24 12c-3-3-11-3-12 5-1 9 6 22 12 20 6 2 13-11 12-20-1-8-9-8-12-5z" /><path d="M24 12c0-4 2-6 5-7" /><path d="M24 12c-1-5 2-8 7-8-.5 5-3 8-7 8z" {...A} /></>,
  battery: <><rect x="12" y="11" width="24" height="32" rx="3" /><path d="M20 6h8v5h-8z" /><path d="M16 29h16v10H16z" {...A} /><path d="M25 16l-4 7h6l-4 7" /></>,
  bin: <><path d="M10 13h28M19 13V8h10v5M13 13l2.5 30h17L35 13" /><path d="M14.3 25h19.4l-1 12H15.3z" {...A} /><path d="M21 19v18M27 19v18" /></>,
  bowl: <><path d="M7 24h34a17 17 0 0 1-34 0z" /><path d="M14 24c1-5 5-8 10-8s9 3 10 8z" {...A} /><path d="M18 41h12" /></>,
};

// Emoji stored on existing listings → drawn glyph. Unknown emoji fall back to the box.
const FROM_EMOJI: Record<string, string> = {
  "🧴": "bottle", "👜": "tote", "🪴": "plant", "📚": "books", "👕": "shirt", "🪱": "compost", "🥢": "cutlery", "🌳": "tree",
  "📦": "box", "🧸": "teddy", "🪑": "chair", "🚲": "bike", "🔌": "plug", "🎒": "backpack", "🍳": "pan",
  "🍾": "jar", "🥫": "can", "🍌": "apple", "🔋": "battery", "🗑️": "bin", "🥗": "bowl",
};
// Waste types (and the guide-only FOOD topic) → glyph.
export const WASTE_GLYPH: Record<string, string> = { PLASTIC: "bottle", PAPER: "box", GLASS: "jar", METAL: "can", ORGANIC: "apple", EWASTE: "battery", TEXTILE: "shirt", OTHER: "bin", FOOD: "bowl" };
export const glyphFor = (emoji: string) => FROM_EMOJI[emoji] ?? (emoji in GLYPHS ? emoji : "box");

export function Glyph({ name, accent = "#a2d47e", className = "h-10 w-10", label }: { name: string; accent?: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
      style={{ ["--glyph-accent" as string]: accent }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {GLYPHS[glyphFor(name)]}
    </svg>
  );
}
