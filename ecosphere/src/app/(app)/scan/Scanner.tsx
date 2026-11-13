"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="card relative flex aspect-square items-center justify-center overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} src={preview} alt="Item to classify" className="h-full w-full object-cover" onLoad={analyse} />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-mute">
            <Camera size={40} className="text-leaf" />
            <p>Take a photo or upload an image of the item</p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-leaf/40" />
        {busy && <div className="absolute inset-0 grid place-items-center bg-ink/60"><Loader2 className="animate-spin text-leaf" size={36} /></div>}
      </div>

      <div className="flex items-center justify-center gap-6">
        <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-full bg-leaf text-ink shadow-lg shadow-leaf/30" aria-label="Take photo">
          <Camera />
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-line" aria-label="Upload image">
          <ImagePlus size={20} />
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      <p className="flex items-center justify-center gap-1 text-xs text-mute">
        <ShieldCheck size={14} className="text-leaf" />
        {status === "loading" && "Loading on-device AI model…"}
        {status === "ready" && "On-device AI ready. Your photo never leaves this phone."}
        {status === "failed" && "AI model unavailable offline. You can still log items manually."}
      </p>

      {message && <p role="status" className="card p-3 text-center text-sm text-leaf">{message}</p>}

      {result && (
        <section className="card flex flex-col gap-3 p-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{g.emoji}</span>
            <div className="flex-1">
              <p className="font-semibold capitalize">{result.label}</p>
              <p className="text-sm" style={{ color: g.binColor }}>{g.bin}</p>
            </div>
            {result.confidence > 0 && <span className="chip">{Math.round(result.confidence * 100)}% sure</span>}
          </div>
          {result.confidence < LOW_CONFIDENCE && (
            <p className="rounded-lg bg-yellow-500/10 p-2 text-xs text-yellow-300">Not sure about this one. Please check the category below. You know your item best.</p>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-mute">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-xs text-mute">Correct the category if the AI got it wrong</legend>
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
      )}
    </div>
  );
}
