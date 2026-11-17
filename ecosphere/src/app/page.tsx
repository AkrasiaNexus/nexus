import Link from "next/link";
import { LeafLogo, PlanetGlow } from "@/components/art";

export default function Splash() {
  return (
    <div className="relative isolate mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-between overflow-hidden px-8 pb-14 pt-40 text-center">
      <PlanetGlow />
      <div className="flex flex-col items-center gap-5">
        {/* Brand entrance: the leaf comes into focus, then the name and promise follow it. */}
        <span className="blur-in"><LeafLogo size={120} /></span>
        <h1 className="text-4xl font-semibold tracking-tight" style={{ animation: "rise-in 750ms 300ms var(--ease-out) both" }}>EcoSphere <span className="text-leaf">AI</span></h1>
        <p className="max-w-[16rem] text-lg leading-snug text-white/75" style={{ animation: "rise-in 750ms 460ms var(--ease-out) both" }}>A smarter way to make a greener impact.</p>
      </div>
      <div className="flex w-full flex-col gap-4" style={{ animation: "rise-in 750ms 640ms var(--ease-out) both" }}>
        <Link href="/login" className="btn py-3.5">Log In</Link>
        <Link href="/signup" className="btn-ghost bg-black/30 py-3.5">Sign In</Link>
      </div>
    </div>
  );
}
