import { Critter } from "./Critter";

// Profile avatar with the user's equipped cosmetics (background, border ring, sticker badge).
const BACKGROUNDS: Record<string, string> = {
  forest: "linear-gradient(140deg,#1e3a28,#3f7a4c)",
  ocean: "linear-gradient(140deg,#123a4a,#2f7f93)",
  sunrise: "linear-gradient(140deg,#5a2e1a,#d98a4b)",
};
const BORDERS: Record<string, string> = { leaf: "#a2d47e", gold: "#e9b44c" };

export type Cosmetics = { background?: string | null; border?: string | null; sticker?: string | null };

export function Avatar({ emoji, size = 112, cosmetics = {} }: { emoji: string; size?: number; cosmetics?: Cosmetics }) {
  const ring = cosmetics.border ? BORDERS[cosmetics.border] : "rgba(162,212,126,.4)";
  return (
    <span className="relative inline-grid place-items-center rounded-full" style={{ width: size, height: size, boxShadow: `0 0 0 ${Math.max(3, size / 28)}px ${ring}` }}>
      <Critter avatar={emoji} size={size} background={cosmetics.background ? BACKGROUNDS[cosmetics.background] : undefined} />
      {cosmetics.sticker && (
        <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-ink" style={{ width: size * 0.36, height: size * 0.36, fontSize: size * 0.2 }}>
          {cosmetics.sticker}
        </span>
      )}
    </span>
  );
}

export const backgroundCss = (key: string) => BACKGROUNDS[key];
export const borderColor = (key: string) => BORDERS[key];
