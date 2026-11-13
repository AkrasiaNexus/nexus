import { PARTNERS, mapsLink } from "@/lib/partners";
import { Header } from "@/components/ui";

export default function Partners() {
  return (
    <>
      <Header title="Partners & Drop-off" />
      <div className="flex flex-col gap-3 px-5">
        <p className="text-sm text-mute">Local recyclers, NGOs and businesses that close the loop. Tap to find the nearest one.</p>
        {PARTNERS.map((p) => (
          <a key={p.name} href={mapsLink(p.name)} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 hover:border-leaf">
            <span className="text-2xl">{p.emoji}</span>
            <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-mute">{p.accepts}</p></div>
            <span className="chip">{p.type}</span>
          </a>
        ))}
      </div>
    </>
  );
}
