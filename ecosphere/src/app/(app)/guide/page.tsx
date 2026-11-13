import Link from "next/link";
import type { WasteType } from "@prisma/client";
import { GUIDE, WASTE_TYPES } from "@/lib/waste";
import { Header } from "@/components/ui";
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
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Waste types">
          {WASTE_TYPES.map((t) => (
            <Link key={t} href={`/guide?type=${t}`} className={`chip shrink-0 ${t === type ? "chip-on" : ""}`}>{GUIDE[t].name}</Link>
          ))}
        </nav>
        <section className="card overflow-hidden">
          <div className="grid h-40 place-items-center bg-gradient-to-b from-panel to-card text-7xl">{g.emoji}</div>
          <div className="space-y-3 p-4">
            <div>
              <h2 className="text-xl font-semibold">{g.name}</h2>
              <p className="text-sm" style={{ color: g.binColor }}>Goes in: {g.bin}</p>
              <a href={mapsLink(type === "ORGANIC" ? "composting site" : type === "EWASTE" ? "e-waste recycling" : type === "TEXTILE" ? "clothing donation bank" : "recycling centre")}
                target="_blank" rel="noopener noreferrer" className="text-xs text-leaf underline-offset-2 hover:underline">📍 Where to drop it off nearby ↗</a>
            </div>
            <div>
              <h3 className="text-sm font-medium text-leaf">How to recycle</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-mute">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-300">Avoid</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{g.avoid.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-leaf">Reuse & repurpose first</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{REUSE[type].map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
        </section>
        <section className="card flex gap-3 p-4">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-medium text-leaf">Did you know?</p>
            <p className="text-sm text-mute">{g.fact}</p>
          </div>
        </section>
        <Link href="/partners" className="btn-ghost">Local recyclers, NGOs & partners</Link>
        <Link href="/scan" className="btn">Scan an item</Link>
      </div>
    </>
  );
}
