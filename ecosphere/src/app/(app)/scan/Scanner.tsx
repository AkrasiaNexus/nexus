"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Loader2, Recycle, ShieldCheck } from "lucide-react";
import type { WasteType } from "@prisma/client";
import { GUIDE, WASTE_TYPES, classify } from "@/lib/waste";
import { saveScan } from "../../actions";

type Model = { classify: (img: HTMLImageElement, k?: number) => Promise<{ className: string; probability: number }[]> };
type Result = { wasteType: WasteType; label: string; confidence: number };

const LOW_CONFIDENCE = 0.5; // below this the user is asked to confirm the category

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
  const [earned, setEarned] = useState<{ points: number; key: number } | null>(null);

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
    // fromPixels reads the element at its rendered box, which distorts a cropped preview; use the source pixels.
    const source = new Image();
    source.src = img.current.src;
    await source.decode();
    const r = classify(await model.current.classify(source, 5));
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
    if (res?.points) setEarned({ points: res.points, key: Date.now() });
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
        {/* While the model reads the photo, a scan line sweeps the frame: the AI is visibly working. */}
        {busy && (
          <div className="absolute inset-0 overflow-hidden bg-ink/30" aria-label="Analysing photo">
            <div className="scan-line absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-leaf/35 to-transparent" style={{ animation: "scan-sweep 1.1s var(--ease-out) infinite alternate" }} />
            <Loader2 className="absolute inset-0 m-auto animate-spin text-leaf motion-reduce:animate-none" size={30} />
          </div>
        )}
        {earned && <span key={earned.key} className="float-up pointer-events-none absolute inset-x-0 bottom-10 text-center text-2xl font-bold text-leaf" aria-hidden>+{earned.points} pts</span>}
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

      {message && <p key={message} role="status" className="sheet-up card p-3 text-center text-sm text-leaf">{message}</p>}

      {result && (
        <>
          <section key={result.label} className="sheet-up card flex items-center gap-4 p-4" aria-live="polite">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2f6b34] to-[#163a1b] text-[#9be292]"><Recycle size={28} className="spin-once" /></span>
            <div className="flex-1">
              <p className="text-lg font-semibold capitalize">{result.label}</p>
              <p className="font-semibold text-leaf">{g.action}</p>
            </div>
            {result.confidence > 0 && <span className="chip">{Math.round(result.confidence * 100)}%</span>}
          </section>

          <section className="sheet-up card flex flex-col gap-3 p-4" style={{ animationDelay: "90ms" }}>
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
