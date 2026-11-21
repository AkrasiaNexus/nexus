import Link from "next/link";
import { LeafLogo } from "@/components/art";

export const metadata = { title: "Privacy, terms & contact · EcoSphere AI" };

export default function Legal() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-white/80">
      <Link href="/" className="mb-10 flex items-center gap-2 font-semibold text-white"><LeafLogo size={22} />EcoSphere <span className="text-leaf">AI</span></Link>
      <section id="privacy" className="scroll-mt-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy</h1>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed">
          <li>The AI scanner runs on your device. Photos are not uploaded unless your school turns on a hosted classifier, and the scanner tells you when it does.</li>
          <li>Marketplace photos are stripped of location and camera data before they are published.</li>
          <li>Students only appear to their own school; parents see a child only after the child approves the link.</li>
          <li>Signed-in users can download all their data or delete their account from Privacy in the app.</li>
        </ul>
      </section>
      <section id="terms" className="mt-12 scroll-mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Terms</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed">
          <li>EcoCreds have no cash value and can only be spent inside EcoSphere AI.</li>
          <li>Only list safe, clean items you own. Hand-overs happen at school or in a public place.</li>
          <li>Impact numbers use published average factors per material; they are estimates for awareness, not audits.</li>
        </ul>
      </section>
      <section id="contact" className="mt-12 scroll-mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Contact</h2>
        <p className="mt-4 leading-relaxed">Students, parents and staff: contact your school or community administrator first. They can reach the platform team through the app.</p>
      </section>
      <div className="mt-12 flex gap-3"><Link href="/signup" className="btn">Get started</Link><Link href="/login" className="btn-ghost">Log in</Link></div>
    </main>
  );
}
