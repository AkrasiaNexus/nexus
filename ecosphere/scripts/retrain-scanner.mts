// Retrain the scanner's head from users' confirmed scans:  npx tsx scripts/retrain-scanner.mts [--dry]
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env. Mixes the public-dataset replay set
// (scripts/data/scanner-replay.bin) with scan_feedback, and only writes src/lib/scannerHead.json if no bin
// gets worse on a trusted held-out slice of the replay set.
import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
const T = await import("../src/lib/headTrainer.ts");
const { DIM, SCALE, trainHead, predict } = (T.DIM ? T : T.default) as typeof import("../src/lib/headTrainer.ts");

const HEAD_PATH = new URL("../src/lib/scannerHead.json", import.meta.url);
const REPLAY_PATH = new URL("./data/scanner-replay.bin", import.meta.url);
const PER_USER_CAP = 200; // limits how much any one account can steer the model
const FEEDBACK_WEIGHT = 2; // confirmed real-world scans count double vs the public datasets
const REPLAY_Q = 200; // replay rows are int8: value / 200 (98% of predictions unchanged vs float)
const dry = process.argv.includes("--dry");

const head = JSON.parse(readFileSync(HEAD_PATH, "utf8"));
const types: string[] = head.types;

// Replay set: per row 1 label byte + 512 int8 values.
const raw = readFileSync(REPLAY_PATH);
const nReplay = raw.length / (DIM + 1);
const replay = { X: new Float32Array(nReplay * DIM), y: new Uint8Array(nReplay) };
for (let i = 0; i < nReplay; i++) {
  replay.y[i] = raw[i * (DIM + 1)];
  for (let d = 0; d < DIM; d++) replay.X[i * DIM + d] = raw.readInt8(i * (DIM + 1) + 1 + d) / REPLAY_Q;
}

try { process.loadEnvFile(".env"); } catch { /* env may come from the shell */ }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
type Row = { userId: string; embedding: number[]; chosen: string; predicted: string };
const rows: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("scan_feedback").select('"userId", embedding, chosen, predicted').order("createdAt", { ascending: false }).range(from, from + 999);
  if (error) throw error;
  rows.push(...(data as Row[]));
  if (data.length < 1000) break;
}
const perUser = new Map<string, number>();
const feedback = rows.filter((r) => {
  const n = (perUser.get(r.userId) ?? 0) + 1;
  perUser.set(r.userId, n);
  return n <= PER_USER_CAP && r.embedding?.length === DIM && types.includes(r.chosen);
});
// Re-normalise: the RPC already rejects non-unit vectors, this guards older or hand-inserted rows.
const unit = (v: number[]) => { const len = Math.hypot(...v) || 1; return v.map((x) => x / len); };
const used = feedback.map((r) => ({ ...r, embedding: unit(r.embedding) }));
console.log(`replay ${nReplay} · feedback ${used.length} from ${perUser.size} users · corrections ${used.filter((r) => r.chosen !== r.predicted).length}`);
if (used.length === 0) { console.log("No user feedback yet: nothing to learn from."); process.exit(0); }

// The gate is trusted data only (users could poison any feedback-based check): every 10th replay row is held out.
const isGate = (i: number) => i % 10 === 0;
const gate = Array.from({ length: nReplay }, (_, i) => i).filter(isGate);
const train = Array.from({ length: nReplay }, (_, i) => i).filter((i) => !isGate(i));
const n = train.length + used.length;
const X = new Float32Array(n * DIM), y = new Uint8Array(n), weight = new Float32Array(n).fill(1);
train.forEach((r, i) => { X.set(replay.X.subarray(r * DIM, (r + 1) * DIM), i * DIM); y[i] = replay.y[r]; });
used.forEach((r, i) => { const j = train.length + i; X.set(r.embedding, j * DIM); y[j] = types.indexOf(r.chosen); weight[j] = FEEDBACK_WEIGHT; });
const fit = (m: number) => ({ ...head, scale: SCALE, ...trainHead(X.subarray(0, m * DIM), y.subarray(0, m), types.length, { lam: head.lam ?? 1e-3, weight: weight.subarray(0, m) }) });
// Fair baseline: same recipe without feedback (the shipped head saw the gate rows, so it can't be the yardstick).
const base = fit(train.length), next = fit(n);

// Per-bin accuracy on the trusted gate: no bin may drop more than 3 points.
const perBin = (h: typeof head) => types.map((_, k) => {
  const rows = gate.filter((r) => replay.y[r] === k);
  const ok = rows.filter((r) => { const p = predict(h, replay.X.subarray(r * DIM, (r + 1) * DIM)); return p.indexOf(Math.max(...p)) === k; }).length;
  return ok / Math.max(1, rows.length);
});
const [before, after] = [perBin(base), perBin(next)];
console.log("trusted held-out photos, without → with user feedback:");
types.forEach((t, k) => console.log(`  ${t.padEnd(8)} ${(before[k] * 100).toFixed(1)}% → ${(after[k] * 100).toFixed(1)}%`));
if (dry) process.exit(0);
if (after.some((a, k) => a < before[k] - 0.03)) { console.log("A bin got worse on trusted photos; keeping the current head. Check the corrections for abuse."); process.exit(0); }
const round = (v: number) => Math.round(v * 1e5) / 1e5;
writeFileSync(HEAD_PATH, JSON.stringify({ ...next, W: next.W.map((r: number[]) => r.map(round)), b: next.b.map(round), trainedAt: new Date().toISOString() }));
console.log("wrote src/lib/scannerHead.json. Also re-check on your own real photos, then commit it and redeploy.");
