import { Glyph, glyphFor } from "./Glyph";

// Five muted field colours (surface, accent, ink). An item always gets the same pair, picked from its glyph name.
const PALETTES = [
  ["#1c2b20", "#a2d47e", "#e4efe2"], // moss
  ["#2b2419", "#e9b44c", "#f3e9d6"], // sand
  ["#2c1d1a", "#e58a6b", "#f4e3dc"], // clay
  ["#18262b", "#7cc3d6", "#dcedf2"], // tide
  ["#241c2b", "#b9a2e6", "#ebe3f6"], // dusk
] as const;
const paletteFor = (key: string) => PALETTES[Array.from(key).reduce((h, c) => h + c.charCodeAt(0), 0) % PALETTES.length];

// Listing photo when the owner uploaded one; otherwise a drawn glyph on a tinted specimen card.
export function ItemArt({ emoji, src, alt = "", size = "h-32" }: { emoji: string; src?: string | null; alt?: string; size?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user upload from Supabase Storage, already size-capped server-side
    return <img src={src} alt={alt} loading="lazy" className={`${size} w-full rounded-xl bg-card object-cover`} />;
  }
  const name = glyphFor(emoji);
  const [surface, accent, ink] = paletteFor(name);
  return (
    <div className={`${size} relative grid w-full place-items-center overflow-hidden rounded-xl`}
      style={{ backgroundColor: surface, backgroundImage: `radial-gradient(${ink}1f 1px, transparent 1.2px)`, backgroundSize: "12px 12px", color: ink }}>
      <Glyph name={name} accent={accent} className="h-[62%] w-auto max-w-[72%] drop-shadow-[0_6px_10px_rgba(0,0,0,.35)]" label={alt || undefined} />
    </div>
  );
}
