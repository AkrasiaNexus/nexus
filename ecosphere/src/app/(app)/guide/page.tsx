import Link from "next/link";
import { Lightbulb, Search } from "lucide-react";
import { Header, IconCircle } from "@/components/ui";
import { mapsLink } from "@/lib/partners";
import { EXAMPLES, REUSE, TOPICS, info, searchGuide, shortName, type Topic } from "@/lib/guide";

const DROP_OFF: Partial<Record<Topic, string>> = { ORGANIC: "composting site", FOOD: "food bank", EWASTE: "e-waste recycling", TEXTILE: "clothing donation bank" };

export default function Guide({ searchParams }: { searchParams: { type?: string; q?: string } }) {
  const type = (TOPICS as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as Topic) : "PLASTIC";
  const g = info(type);
  const q = (searchParams.q ?? "").slice(0, 60);
  const results = searchGuide(q);
  return (
    <>
      <Header title="Recycling Guide" />
      <div className="stagger flex flex-col gap-4 px-5">
        <form className="relative" role="search">
          <Search size={18} className="absolute left-4 top-3.5 text-white/50" />
          <input name="q" defaultValue={q} placeholder="Search an item, e.g. battery, jar…" className="input rounded-full pl-11" aria-label="Search the guide" />
        </form>
        {q && (
          <section className="card p-4" aria-live="polite">
            <h2 className="mb-2 text-sm font-medium">{results.length ? `Results for "${q}"` : `No match for "${q}"`}</h2>
            {results.length ? (
              <ul className="flex flex-col gap-1">
                {results.map((r) => (
                  <li key={r.topic}>
                    <Link href={`/guide?type=${r.topic}`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-panel">
                      <span className="text-xl" aria-hidden>{info(r.topic).emoji}</span>
                      <span className="flex-1">{info(r.topic).name}{r.hit && <span className="text-mute"> · {r.hit}</span>}</span>
                      <span className="text-xs" style={{ color: info(r.topic).binColor }}>{info(r.topic).bin}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-mute">Not sure? Try the <Link href="/scan" className="text-leaf underline">AI scanner</Link>, or treat it as general waste.</p>}
          </section>
        )}
        <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Waste types">
          {TOPICS.map((t) => (
            <Link key={t} href={`/guide?type=${t}`} aria-current={t === type ? "page" : undefined} className={`chip shrink-0 px-4 ${t === type ? "chip-on" : ""}`}>{shortName(t)}</Link>
          ))}
        </nav>
        <section className="card overflow-hidden">
          <div className="grid h-48 place-items-center bg-[radial-gradient(circle_at_60%_40%,#24342a,#0b120d_70%)] text-8xl"><span key={type} className="blur-in drop-shadow-[0_10px_14px_rgba(0,0,0,.7)]">{g.emoji}</span></div>
          <div className="space-y-1 p-5">
            <h2 className="text-2xl font-semibold">{g.name}</h2>
            <p className="text-white/75">{g.summary}</p>
          </div>
        </section>
        <section className="card flex items-center gap-4 p-4">
          <IconCircle size={52}><Lightbulb size={26} /></IconCircle>
          <div>
            <p className="font-semibold text-leaf">Did you know?</p>
            <p className="text-sm text-white/70">{g.fact}</p>
          </div>
        </section>
        <section className="card space-y-3 p-4">
          <p className="text-sm" style={{ color: g.binColor }}>Goes in: {g.bin}</p>
          <div>
            <h3 className="text-sm font-medium text-leaf">Examples</h3>
            <ul className="mt-1 flex flex-wrap gap-1.5">{EXAMPLES[type].map((x) => <li key={x} className="chip text-xs">{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-leaf">{type === "FOOD" ? "How to cut food waste" : "How to recycle"}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/65">{g.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-300">Avoid</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/65">{g.avoid.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-leaf">Reuse & repurpose first</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/65">{REUSE[type].map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <a href={mapsLink(DROP_OFF[type] ?? "recycling centre")}
            target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-leaf">📍 Where to drop it off nearby ↗</a>
        </section>
        <Link href="/partners" className="btn-ghost">Local recyclers, NGOs & partners</Link>
      </div>
    </>
  );
}
