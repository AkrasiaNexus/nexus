import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between px-8 py-16 text-center">
      <div />
      <div className="flex flex-col items-center gap-4">
        <Logo size={110} />
        <h1 className="text-4xl font-semibold">EcoSphere <span className="text-leaf">AI</span></h1>
        <p className="max-w-xs text-mute">A smarter way to sort, reduce and reuse. Scan waste with on-device AI, earn green points and track your real impact.</p>
        <p className="text-xs text-mute">Aligned with UN SDG 12 · Responsible Consumption & Production</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/login" className="btn">Log In</Link>
        <Link href="/signup" className="btn-ghost">Sign Up</Link>
      </div>
    </div>
  );
}
