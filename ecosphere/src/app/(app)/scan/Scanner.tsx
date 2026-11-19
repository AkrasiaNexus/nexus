"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Camera, CameraOff, ChevronDown, ImagePlus, Loader2, Recycle, ShieldCheck } from "lucide-react";
import type { WasteType } from "@/lib/types";
import { GUIDE, WASTE_TYPES } from "@/lib/waste";
import { CLIP_MODEL, TRANSFORMERS_CDN, classifyEmbedding } from "@/lib/clip";
import { saveScan } from "../../actions";
import { Glyph, WASTE_GLYPH } from "@/components/Glyph";

// Runs the on-device model on an image URL (blob: preview) and returns the best waste type.
type Model = (url: string) => Promise<ReturnType<typeof classifyEmbedding>>;
type Result = { wasteType: WasteType; label: string; confidence: number; source?: "server" | "device"; runnerUp?: WasteType; unsure?: boolean; embedding?: number[] };

const LOW_CONFIDENCE = 0.5; // server results below this ask the user to confirm the category
const LEARN_KEY = "eco-scan-learn";
const FRAME = 0.8; // snap keeps the centre 80% of the camera frame, roughly the corner-bracket area
type Cam = "off" | "starting" | "live" | "denied" | "unavailable";
const CAM_HELP: Partial<Record<Cam, string>> = {
  denied: "Camera access is blocked. Allow it in your browser's site settings (the icon left of the address bar), then tap the button again. Or upload a photo.",
  unavailable: "No camera found, or this page isn't on a secure (https) connection. Upload a photo instead.",
};

export function Scanner({ serverAI }: { serverAI: boolean }) {
  const model = useRef<Model | null>(null);
  const picked = useRef<File | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fallbackInput = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<Cam>("off");
  const resultRef = useRef<HTMLElement>(null);
  const [resultInView, setResultInView] = useState(true);
  const img = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [loadPct, setLoadPct] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [type, setType] = useState<WasteType>("PLASTIC");
  const [weight, setWeight] = useState("0.03");
  const [message, setMessage] = useState<string | null>(null);
  const [earned, setEarned] = useState<{ points: number; key: number } | null>(null);
  const [learn, setLearn] = useState(true); // per-device opt-out for the learning loop
  useEffect(() => { try { setLearn(localStorage.getItem(LEARN_KEY) !== "0"); } catch { /* storage blocked: keep default */ } }, []);
  function toggleLearn(on: boolean) {
    setLearn(on);
    try { localStorage.setItem(LEARN_KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
  }

  useEffect(() => {
    // CLIP image model runs fully in the browser; photos never leave the device. ~64 MB, downloaded once then cached.
    (async () => {
      try {
        // Loaded from the CDN at a pinned version, not bundled: Next 14's bundler can't parse onnxruntime-web.
        const { AutoProcessor, CLIPVisionModelWithProjection, RawImage } = (await import(/* webpackIgnore: true */ TRANSFORMERS_CDN)) as typeof import("@huggingface/transformers");
        const progress = (p: { status: string; file?: string; progress?: number }) => {
          if (p.status === "progress" && p.file?.endsWith(".onnx")) setLoadPct(Math.round(p.progress ?? 0));
        };
        const [processor, vision] = await Promise.all([
          AutoProcessor.from_pretrained(CLIP_MODEL),
          CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "q4", progress_callback: progress }),
        ]);
        model.current = async (url) => {
          const { image_embeds } = await vision(await processor(await RawImage.fromURL(url)));
          return classifyEmbedding(image_embeds.data as Float32Array);
        };
        setStatus("ready");
      } catch (e) {
        console.error("Scanner AI model failed to load", e);
        setStatus("failed");
      }
    })();
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  // First tap asks the browser for camera permission and opens a live preview; the next tap takes the photo.
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      // No live-camera API (old browser / plain http): fall back to the phone's native camera picker.
      setCam("unavailable");
      return fallbackInput.current?.click();
    }
    setCam("starting");
    setResult(null);
    setMessage(null);
    setPreview(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      setCam("live");
    } catch (e) {
      // NotAllowedError = user/OS blocked it (older Chrome: PermissionDeniedError; Safari can report SecurityError).
      setCam(["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes((e as DOMException).name) ? "denied" : "unavailable");
    }
  }

  // The result lands below the camera frame: bring it into view, and keep a "see result" cue while it's off-screen.
  useEffect(() => {
    const el = resultRef.current;
    if (!result || !el) return;
    // rootMargin: ignore the strip hidden under the mobile bottom nav.
    const io = new IntersectionObserver(([e]) => setResultInView(e.isIntersecting), { threshold: 0.6, rootMargin: "0px 0px -96px 0px" });
    io.observe(el);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }), 350);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [result]);

  // Attach the stream once the <video> is on screen.
  useEffect(() => {
    if (cam === "live" && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => setCam("unavailable"));
    }
  }, [cam]);

  function snap() {
    const v = video.current;
    if (!v?.videoWidth) return;
    // Crop to the framed centre: less background clutter for the model to latch onto.
    // shortcut: fixed 80% crop, not the exact on-screen bracket box (object-cover offsets); measure on real photos before refining.
    const w = Math.round(v.videoWidth * FRAME), h = Math.round(v.videoHeight * FRAME);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
    canvas.toBlob((blob) => {
      stopCamera();
      setCam("off");
      if (blob) onFile(new File([blob], "scan.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  function pickType(t: WasteType) {
    setType(t);
    setWeight(String(GUIDE[t].defaultKg));
  }

  function onFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    stopCamera();
    setCam("off");
    setResult(null);
    setMessage(null);
    picked.current = file;
    setPreview(URL.createObjectURL(file));
  }

  // Hosted classifier first when configured; any failure falls back to the on-device model.
  async function serverClassify(): Promise<Result | null> {
    if (!serverAI || !picked.current) return null;
    const body = new FormData();
    body.append("photo", picked.current);
    const res = await fetch("/api/classify", { method: "POST", body }).catch(() => null);
    return res?.ok ? { ...(await res.json()), source: "server" } : null;
  }

  async function analyse() {
    if (!img.current) return;
    setBusy(true);
    const remote = await serverClassify();
    setBusy(false);
    if (remote) {
      setResult(remote);
      return pickType(remote.wasteType);
    }
    if (!model.current) {
      setResult({ wasteType: "OTHER", label: "Manual entry", confidence: 0 });
      return pickType("OTHER");
    }
    setBusy(true);
    const r = { ...(await model.current(img.current.src)), source: "device" as const };
    setResult(r);
    pickType(r.wasteType);
    setBusy(false);
  }

  async function save() {
    if (!result) return;
    setBusy(true);
    const feedback = learn && result.embedding && result.source === "device" ? { embedding: result.embedding, predicted: result.wasteType } : undefined;
    const res = await saveScan({ label: result.label, wasteType: type, confidence: result.confidence, weightKg: Number(weight), feedback });
    setBusy(false);
    setMessage(res?.error ?? `+${res?.points} points! Logged as ${GUIDE[type].name}.`);
    if (res?.points) setEarned({ points: res.points, key: Date.now() });
    if (!res?.error) { setResult(null); setPreview(null); }
  }

  const g = GUIDE[type];
  const corner = "absolute h-8 w-8 border-white/80";

  return (
    <div className="stagger flex flex-col gap-4 px-5">
      <div className="relative aspect-[4/3.6] overflow-hidden rounded-3xl border-2 border-white/80 bg-[radial-gradient(circle_at_50%_40%,#3a3f3b,#151a17)]">
        {cam === "live" ? (
          <video ref={video} playsInline muted className="h-full w-full object-cover" aria-label="Live camera preview" />
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} src={preview} alt="Item to classify" className="h-full w-full object-cover" onLoad={analyse} />
        ) : (
          <div className="grid h-full place-items-center text-white/40">
            {cam === "starting" ? <Loader2 size={36} className="animate-spin motion-reduce:animate-none" /> : cam === "denied" || cam === "unavailable" ? <CameraOff size={44} /> : <Camera size={44} />}
          </div>
        )}
        <span className={`${corner} left-8 top-8 rounded-tl-xl border-l-2 border-t-2`} />
        <span className={`${corner} right-8 top-8 rounded-tr-xl border-r-2 border-t-2`} />
        <span className={`${corner} bottom-8 left-8 rounded-bl-xl border-b-2 border-l-2`} />
        <span className={`${corner} bottom-8 right-8 rounded-br-xl border-b-2 border-r-2`} />
        {/* While the model reads the photo, a scan line sweeps the frame: the AI is visibly working. */}
        {busy && (
          <div className="absolute inset-0 overflow-hidden bg-ink/30" aria-label="Analysing photo">
            <div className="scan-line absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-leaf/35 to-transparent" style={{ animation: "scan-sweep 1.4s var(--ease-out) infinite alternate" }} />
            <Loader2 className="absolute inset-0 m-auto animate-spin text-leaf motion-reduce:animate-none" size={30} />
          </div>
        )}
        {earned && <span key={earned.key} className="float-up pointer-events-none absolute inset-x-0 bottom-10 text-center text-2xl font-bold text-leaf" aria-hidden>+{earned.points} EC</span>}
      </div>

      <p className="text-center text-sm text-white/75">
        {cam === "live" ? <>One item at a time, filling the frame.<br />Tap to snap</> : cam === "starting" ? "Allow camera access when your browser asks" : <>Take a photo or upload<br />an image</>}
      </p>
      {CAM_HELP[cam] && <p role="alert" className="card p-3 text-center text-xs text-gold">{CAM_HELP[cam]}</p>}

      <div className="relative flex items-center justify-center">
        <button type="button" onClick={cam === "live" ? snap : startCamera} disabled={cam === "starting" || busy}
          className="grid h-20 w-20 place-items-center rounded-full border-4 border-leaf/40 p-1 disabled:opacity-60" aria-label={cam === "live" ? "Take photo" : "Open camera"}>
          <span className={`h-full w-full rounded-full bg-gradient-to-b from-[#9be292] to-[#6fc267] shadow-lg shadow-leaf/30 ${cam === "live" ? "ring-4 ring-white/80 ring-inset" : ""}`} />
        </button>
        <input ref={fallbackInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {cam === "live" && (
          <button type="button" onClick={() => { stopCamera(); setCam("off"); }} className="absolute left-4 grid h-12 w-12 place-items-center rounded-2xl bg-card" aria-label="Close camera"><CameraOff size={22} /></button>
        )}
        <label className="absolute right-4 grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-card" aria-label="Upload image">
          <ImagePlus size={22} />
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      <p className="flex items-center justify-center gap-1 text-xs text-white/50">
        <ShieldCheck size={14} className="text-leaf" />
        {status === "loading" && (loadPct > 0 && loadPct < 100 ? `Downloading AI model… ${loadPct}% (one time only)` : "Loading on-device AI model…")}
        {status === "ready" && (serverAI ? "Server AI enabled: photos go to the school's configured classifier, with on-device AI as backup." : "On-device AI. Your photo never leaves this phone.")}
        {status === "failed" && "AI model unavailable offline. You can still log items manually."}
      </p>

      {message && <p key={message} role="status" className="sheet-up card p-3 text-center text-sm text-leaf">{message}</p>}

      {/* Portal: the page's transition wrapper keeps a transform, which would pin `fixed` to the page instead of the screen. */}
      {result && !resultInView && createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center md:bottom-8">
          <button type="button" onClick={() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="sheet-up pointer-events-auto flex items-center gap-2 rounded-full bg-leaf py-2.5 pl-4 pr-3 text-sm font-semibold text-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,.7)]">
            See your result <ChevronDown size={18} className="nudge" aria-hidden />
          </button>
        </div>,
        document.body,
      )}

      {result && (
        <>
          <section ref={resultRef} key={result.label} className="sheet-up card flex scroll-mt-24 items-center gap-4 p-4" aria-live="polite">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2f6b34] to-[#163a1b] text-[#9be292]"><Recycle size={28} className="spin-once" /></span>
            <div className="flex-1">
              <p className="text-lg font-semibold capitalize">{result.label}</p>
              <p className="font-semibold text-leaf">{g.action}</p>
              {result.source && <p className="text-[11px] text-mute">{result.source === "server" ? "Server AI" : "On-device AI"}</p>}
            </div>
            {result.confidence > 0 && <span className="chip">{Math.round(result.confidence * 100)}%</span>}
          </section>

          <section className="sheet-up card flex flex-col gap-3 p-4" style={{ animationDelay: "110ms" }}>
            {result.unsure && result.runnerUp ? (
              <div className="rounded-xl bg-yellow-500/10 p-3">
                <p className="mb-2 text-sm text-yellow-200">Not quite sure. Which is it?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[result.wasteType, result.runnerUp].map((t) => (
                    <button key={t} type="button" onClick={() => pickType(t)} aria-pressed={t === type}
                      className={`press flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${t === type ? "border-leaf bg-leaf text-ink" : "border-white/10 bg-card"}`}>
                      <Glyph name={WASTE_GLYPH[t]} className="h-5 w-5" />{GUIDE[t].name}
                    </button>
                  ))}
                </div>
              </div>
            ) : !result.unsure && result.confidence < LOW_CONFIDENCE && result.source === "server" && (
              <p className="rounded-lg bg-yellow-500/10 p-2 text-xs text-yellow-300">Not sure about this one. Please check the category below. You know your item best.</p>
            )}
            <p className="text-sm"><span style={{ color: g.binColor }}>●</span> {g.name} → {g.bin}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/65">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-xs text-white/50">Correct the category if the AI got it wrong</legend>
              {WASTE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => pickType(t)} aria-pressed={t === type}
                  className={`chip ${t === type ? "chip-on" : ""}`}><Glyph name={WASTE_GLYPH[t]} className="-ml-0.5 mr-1 inline h-4 w-4 align-[-3px]" />{GUIDE[t].name}</button>
              ))}
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              Approx. weight
              <input type="number" min="0.01" max="50" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} className="input w-24 py-2" /> kg
            </label>
            <button className="btn" onClick={save} disabled={busy || !(Number(weight) > 0)}>Log it · +{g.points} EC</button>
            {result.embedding && (
              <label className="flex items-start gap-2 text-[11px] text-mute">
                <input type="checkbox" checked={learn} onChange={(e) => toggleLearn(e.target.checked)} className="mt-0.5 accent-[#a2d47e]" />
                <span>Help the scanner learn: share this photo&apos;s fingerprint (a list of numbers, never the photo) and the bin you chose. Linked to your account, deleted after 180 days.</span>
              </label>
            )}
            <Link href={`/guide?type=${type}`} className="text-center text-xs text-leaf">Full recycling guide →</Link>
          </section>
        </>
      )}
    </div>
  );
}
