// Item photo when the owner uploaded one; otherwise the emoji stand-in on a lit backdrop (mockup's 3D renders).
export function ItemArt({ emoji, src, alt = "", size = "h-32", text = "text-6xl" }: { emoji: string; src?: string | null; alt?: string; size?: string; text?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user upload from Supabase Storage, already size-capped server-side
    return <img src={src} alt={alt} loading="lazy" className={`${size} w-full rounded-xl bg-card object-cover`} />;
  }
  return (
    <div className={`grid ${size} place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_35%,#2a3a2e,#0c130e_70%)] ${text} drop-shadow-[0_10px_12px_rgba(0,0,0,.6)]`}>
      <span className="drop-shadow-[0_8px_10px_rgba(0,0,0,.7)]">{emoji}</span>
    </div>
  );
}
