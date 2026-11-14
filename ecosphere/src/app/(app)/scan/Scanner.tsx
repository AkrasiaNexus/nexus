"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Loader2, Recycle, ShieldCheck } from "lucide-react";
import type { WasteType } from "@prisma/client";
import { GUIDE, WASTE_TYPES, classify } from "@/lib/waste";
import { saveScan } from "../../actions";

type Model = { classify: (img: HTMLImageElement, k?: number) => Promise<{ className: string; probability: number }[]> };
type Result = { wasteType: WasteType; label: string; confidence: number };

const LOW_CONFIDENCE = 0.35;

export function Scanner() {
  const model = useRef<Model | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [type, setType] = useState<WasteType>("PLASTIC");
  const [weight, setWeight] = useState("0.03");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Model runs fully in the browser; photos never leave the device.
    (async () => {
      try {
        await import("@tensorflow/tfjs");
        const mobilenet = await import("@tensorflow-models/mobilenet");
        // Self-hosted weights: no third-party model host, works for offline/school networks.
        model.current = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: "/models/mobilenet/model.json", inputRange: [-1, 1] });
        setStatus("ready");
      } catch {
        setStatus("failed");
      }
    })();
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pickType(t: WasteType) {
    setType(t);
    setWeight(String(GUIDE[t].defaultKg));
  }

  function onFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setResult(null);
    setMessage(null);
    setPreview(URL.createObjectURL(file));
  }

  async function analyse() {
    if (!img.current) return;
    if (!model.current) {
      setResult({ wasteType: "OTHER", label: "Manual entry", confidence: 0 });
      return pickType("OTHER");
    }
    setBusy(true);
    const r = classify(await model.current.classify(img.current, 5));
    setResult(r);
    pickType(r.wasteType);
    setBusy(false);
  }

  async function save() {
    if (!result) return;
    setBusy(true);
    const res = await saveScan({ label: result.label, wasteType: type, confidence: result.confidence, weightKg: Number(weight) });
    setBusy(false);
    setMessage(res?.error ?? `+${res?.points} points! Logged as ${GUIDE[type].name}.`);
    if (!res?.error) { setResult(null); setPreview(null); }
  }

  const g = GUIDE[type];
  const corner = "absolute h-8 w-8 border-white/80";

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="relative aspect-[4/3.6] overflow-hidden rounded-3xl border-2 border-white/80 bg-[radial-gradient(circle_at_50%_40%,#3a3f3b,#151a17)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} src={preview} alt="Item to classify" className="h-full w-full object-cover" onLoad={analyse} />
        ) : (
          <div className="grid h-full place-items-center text-white/40"><Camera size={44} /></div>
        )}
        <span className={`${corner} left-8 top-8 rounded-tl-xl border-l-2 border-t-2`} />
        <span className={`${corner} right-8 top-8 rounded-tr-xl border-r-2 border-t-2`} />
        <span className={`${corner} bottom-8 left-8 rounded-bl-xl border-b-2 border-l-2`} />
        <span className={`${corner} bottom-8 right-8 rounded-br-xl border-b-2 border-r-2`} />
        {busy && <div className="absolute inset-0 grid place-items-center bg-ink/60"><Loader2 className="animate-spin text-leaf" size={36} /></div>}
      </div>

      <p className="text-center text-sm text-white/75">Take a photo or upload<br />an image</p>

      <div className="relative flex items-center justify-center">
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-full border-4 border-leaf/40 p-1" aria-label="Take photo">
          <span className="h-full w-full rounded-full bg-gradient-to-b from-[#9be292] to-[#6fc267] shadow-lg shadow-leaf/30" />
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label className="absolute right-4 grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-card" aria-label="Upload image">
          <ImagePlus size={22} />
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      <p className="flex items-center justify-center gap-1 text-xs text-white/50">
        <ShieldCheck size={14} className="text-leaf" />
        {status === "loading" && "Loading on-device AI model…"}
        {status === "ready" && "On-device AI. Your photo never leaves this phone."}
        {status === "failed" && "AI model unavailable offline. You can still log items manually."}
      </p>

      {message && <p role="status" className="card p-3 text-center text-sm text-leaf">{message}</p>}

      {result && (
        <>
          <section className="card flex items-center gap-4 p-4" aria-live="polite">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2f6b34] to-[#163a1b] text-[#9be292]"><Recycle size={28} /></span>
            <div className="flex-1">
              <p className="text-lg font-semibold capitalize">{result.label}</p>
              <p className="font-semibold text-leaf">{g.action}</p>
            </div>
            {result.confidence > 0 && <span className="chip">{Math.round(result.confidence * 100)}%</span>}
          </section>

          <section className="card flex flex-col gap-3 p-4">
            {result.confidence < LOW_CONFIDENCE && (
              <p className="rounded-lg bg-yellow-500/10 p-2 text-xs text-yellow-300">Not sure about this one. Please check the category below. You know your item best.</p>
            )}
            <p className="text-sm"><span style={{ color: g.binColor }}>●</span> {g.emoji} {g.name} → {g.bin}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/65">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-xs text-white/50">Correct the category if the AI got it wrong</legend>
              {WASTE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => pickType(t)} aria-pressed={t === type}
                  className={`chip ${t === type ? "chip-on" : ""}`}>{GUIDE[t].emoji} {GUIDE[t].name}</button>
              ))}
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              Approx. weight
              <input type="number" min="0.01" max="50" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} className="input w-24 py-2" /> kg
            </label>
            <button className="btn" onClick={save} disabled={busy || !(Number(weight) > 0)}>Log it · +{g.points} pts</button>
            <Link href={`/guide?type=${type}`} className="text-center text-xs text-leaf">Full recycling guide →</Link>
          </section>
        </>
      )}
    </div>
  );
}
