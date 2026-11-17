import { currentUser } from "@/lib/auth";
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/upload";
import { classify, type Prediction } from "@/lib/waste";

// Optional hosted classifier. Contract: POST raw image bytes → JSON { predictions: [{ label|className, probability|score }] }.
// Not configured → 501, and the scanner stays on the on-device model.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
// shortcut: in-memory per-instance limit, resets on deploy and isn't shared across instances; move to a DB/Redis counter if abused.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const url = process.env.CLASSIFIER_URL;
  if (!url) return Response.json({ error: "not_configured" }, { status: 501 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const now = Date.now();
  const recent = (hits.get(user.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return Response.json({ error: "Too many scans, wait a minute." }, { status: 429 });
  hits.set(user.id, [...recent, now]);

  // Route handlers have no body limit: refuse oversized bodies before buffering them.
  if (Number(req.headers.get("content-length") ?? Infinity) > MAX_IMAGE_BYTES + 64_000) return Response.json({ error: "Send one image up to 2 MB." }, { status: 413 });
  const photo = (await req.formData().catch(() => null))?.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_IMAGE_BYTES) return Response.json({ error: "Send one image up to 2 MB." }, { status: 400 });
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const check = checkImage(bytes, photo.type);
  if ("error" in check) return Response.json({ error: check.error }, { status: 400 });

  try {
    const res = await fetch(url, {
      method: "POST", body: bytes, signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": check.type, ...(process.env.CLASSIFIER_API_KEY ? { Authorization: `Bearer ${process.env.CLASSIFIER_API_KEY}` } : {}) },
    });
    if (!res.ok) throw new Error(String(res.status));
    const raw = ((await res.json()) as { predictions?: { label?: unknown; className?: unknown; probability?: unknown; score?: unknown }[] }).predictions ?? [];
    const predictions: Prediction[] = raw.slice(0, 10).flatMap((p) => {
      const className = String(p.className ?? p.label ?? "");
      const probability = Number(p.probability ?? p.score);
      return className && Number.isFinite(probability) ? [{ className: className.slice(0, 100), probability: Math.min(Math.max(probability, 0), 1) }] : [];
    });
    if (!predictions.length) throw new Error("empty");
    return Response.json({ ...classify(predictions), source: "server" });
  } catch {
    return Response.json({ error: "Classifier unavailable." }, { status: 502 });
  }
}
