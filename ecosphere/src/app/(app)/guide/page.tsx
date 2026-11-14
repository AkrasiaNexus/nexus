import Link from "next/link";
import type { WasteType } from "@prisma/client";
import { GUIDE, WASTE_TYPES } from "@/lib/waste";
import { Lightbulb } from "lucide-react";
import { Header, IconCircle } from "@/components/ui";
import { mapsLink } from "@/lib/partners";

const REUSE: Record<WasteType, string[]> = {
  PLASTIC: ["Turn bottles into self-watering planters", "Use tubs for storing stationery"],
  PAPER: ["Use one-sided sheets as notepads", "Shred card for compost or packing"],
  GLASS: ["Jars make great food storage and pen pots", "Turn bottles into lamps or vases"],
  METAL: ["Tins become pencil holders or herb pots", "Donate old cookware"],
  ORGANIC: ["Regrow spring onions and celery from scraps", "Make veggie stock from peels"],
  EWASTE: ["Sell or donate working phones", "Use old phones as webcams or music players"],
  TEXTILE: ["Cut old T-shirts into cleaning rags", "Swap clothes at a community event"],
  OTHER: ["Choose products with less packaging next time", "Ask shops about refill options"],
};

export default function Guide({ searchParams }: { searchParams: { type?: string } }) {
  const type = (WASTE_TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as WasteType) : "PLASTIC";
  const g = GUIDE[type];
  return (
    <>
      <Header title="Recycling Guide" />
      <div className="flex flex-col gap-4 px-5">
        <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Waste types">
          {WASTE_TYPES.map((t) => (
            <Link key={t} href={`/guide?type=${t}`} className={`chip shrink-0 px-4 ${t === type ? "chip-on" : ""}`}>{GUIDE[t].name.replace(" & Card", "").replace("Food & ", "")}</Link>
          ))}
        </nav>
        <section className="card overflow-hidden">
          <div className="grid h-48 place-items-center bg-[radial-gradient(circle_at_60%_40%,#24342a,#0b120d_70%)] text-8xl"><span className="drop-shadow-[0_10px_14px_rgba(0,0,0,.7)]">{g.emoji}</span></div>
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
            <h3 className="text-sm font-medium text-leaf">How to recycle</h3>
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
          <a href={mapsLink(type === "ORGANIC" ? "composting site" : type === "EWASTE" ? "e-waste recycling" : type === "TEXTILE" ? "clothing donation bank" : "recycling centre")}
            target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-leaf">📍 Where to drop it off nearby ↗</a>
        </section>
        <Link href="/partners" className="btn-ghost">Local recyclers, NGOs & partners</Link>
      </div>
    </>
  );
}
