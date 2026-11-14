// Product "photo" stand-in: big emoji on a lit dark backdrop, echoing the mockup's 3D renders.
export function ItemArt({ emoji, size = "h-32", text = "text-6xl" }: { emoji: string; size?: string; text?: string }) {
  return (
    <div className={`grid ${size} place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_35%,#2a3a2e,#0c130e_70%)] ${text} drop-shadow-[0_10px_12px_rgba(0,0,0,.6)]`}>
      <span className="drop-shadow-[0_8px_10px_rgba(0,0,0,.7)]">{emoji}</span>
    </div>
  );
}
