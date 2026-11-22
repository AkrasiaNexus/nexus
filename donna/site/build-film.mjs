// Renders film.html to a sixty-second MP4 with narration and sound design.
//
//   node site/build-film.mjs <voice-dir> <out-dir>
//
// <voice-dir> holds one WAV per line of narration.json plus durations.json, written by speak.py.
// AUDIO_ONLY=1 builds the sound and stops, for checking the mix without rendering frames.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [voiceDir, outDir] = process.argv.slice(2);
if (!voiceDir || !outDir) throw new Error("usage: node site/build-film.mjs <voice-dir> <out-dir>");

const FPS = 30;
const TARGET = 60;
const narration = JSON.parse(fs.readFileSync(path.join(HERE, "narration.json"), "utf8"));
const measured = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(voiceDir, "durations.json"), "utf8")).map((d) => [d.id, d.seconds]));

// The room each line wants around it. The speech is never stretched; these gaps are scaled together
// so the film lands on exactly sixty seconds.
const LEAD = { hook: 1.2, turn: 0.3, problem: 0.4, orb: 0.5, refuse: 0.4, patterns: 0.4, night: 0.5, local: 0.4, clock: 0.4, end: 0.6 };
const TAIL = { hook: 0.2, turn: 1.4, problem: 1.0, orb: 1.8, refuse: 2.0, patterns: 1.4, night: 2.0, local: 1.2, clock: 1.4, end: 2.6 };
const speech = narration.reduce((sum, { id }) => sum + measured[id], 0);
const gaps = narration.reduce((sum, { id }) => sum + LEAD[id] + TAIL[id], 0);
const fit = (TARGET - speech) / gaps;
if (fit < 0.5) throw new Error(`${speech.toFixed(1)}s of speech leaves too little room for ${TARGET}s; cut the script`);

let clock = 0;
const timeline = narration.map(({ id, text }) => {
  const start = clock;
  const speechStart = start + LEAD[id] * fit;
  const speechEnd = speechStart + measured[id];
  const end = speechEnd + TAIL[id] * fit;
  clock = end;
  return { id, text, start, speechStart, speechEnd, end };
});
const length = clock;
fs.mkdirSync(outDir, { recursive: true });
console.log(`speech ${speech.toFixed(1)}s, gaps scaled x${fit.toFixed(2)}, film ${length.toFixed(2)}s`);

const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.addInitScript((tl) => { window.TIMELINE = tl; }, timeline);
await page.goto(`file://${path.join(HERE, "film.html")}`);
await page.evaluate(() => document.fonts.ready);
// The film owns every beat; the sound is placed from the same numbers.
const cues = await page.evaluate((tl) => window.cuesFor(tl), timeline);
fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify({ timeline, cues }, null, 1));

// --- sound ---
const ms = (seconds) => Math.max(0, Math.round(seconds * 1000));
const at = (seconds) => `adelay=${ms(seconds)}:all=1`;
const turnHit = cues.turnHit;
const inputs = [];
const graph = [];
const add = (source) => { inputs.push("-f", "lavfi", "-i", source); return inputs.length / 4 - 1 + narration.length; };

narration.forEach(({ id }, i) => graph.push(`[${i}:a]${at(timeline[i].speechStart)}[v${i}]`));
// Padded to full length: the ducking compressor stops with its shortest input, and the voice ends
// before the closing hold, which cut the last boom and the slogan's silence.
graph.push(`${narration.map((_, i) => `[v${i}]`).join("")}amix=inputs=${narration.length}:normalize=0,apad=whole_dur=${length.toFixed(3)},asplit=2[voice][key]`);

// A synth kick at 100 bpm from the turn on, an off-beat hat, and a sub drone under everything.
const beat = 0.6;
const kick = add(`aevalsrc=exprs='gte(t\\,${turnHit})*0.9*sin(2*PI*(42+90*exp(-30*mod(t-${turnHit}\\,${beat})))*mod(t-${turnHit}\\,${beat}))*exp(-7*mod(t-${turnHit}\\,${beat}))':s=48000:d=${length}`);
const hat = add(`aevalsrc=exprs='gte(t\\,${turnHit + beat / 2})*(2*random(0)-1)*exp(-55*mod(t-${turnHit + beat / 2}\\,${beat}))':s=48000:d=${length}`);
const drone = add(`aevalsrc=exprs='0.5*sin(2*PI*41.2*t)+0.25*sin(2*PI*61.7*t)':s=48000:d=${length}`);
graph.push(`[${kick}:a]volume=0.55[k]`, `[${hat}:a]highpass=f=7000,volume=0.16[h]`, `[${drone}:a]lowpass=f=200,volume=0.2,afade=t=in:d=1.5[d]`);
graph.push(`[k][h][d]amix=inputs=3:normalize=0,afade=t=out:st=${(length - 2.5).toFixed(2)}:d=2.5[bed]`);
// The bed ducks whenever she speaks.
graph.push(`[bed][key]sidechaincompress=threshold=0.04:ratio=6:attack=8:release=280[ducked]`);

// Booms on the turn, the refusal and the name; a punch on each cross; a tick on every cut.
const booms = [cues.turnHit, cues.refused, cues.endHit];
const boom = add(`aevalsrc=exprs='sin(2*PI*(28+70*exp(-9*t))*t)*exp(-2.2*t)+0.35*(2*random(0)-1)*exp(-14*t)':s=48000:d=2.5`);
graph.push(`[${boom}:a]lowpass=f=900,asplit=${booms.length}${booms.map((_, i) => `[bo${i}]`).join("")}`);
booms.forEach((h, i) => graph.push(`[bo${i}]${at(h)},volume=0.95[b${i}]`));
const punch = add(`aevalsrc=exprs='sin(2*PI*(55+170*exp(-28*t))*t)*exp(-11*t)':s=48000:d=0.6`);
graph.push(`[${punch}:a]asplit=3[pu0][pu1][pu2]`);
cues.crosses.forEach((h, i) => graph.push(`[pu${i}]${at(h)},volume=0.75[x${i}]`));
const tick = add(`aevalsrc=exprs='(2*random(0)-1)*exp(-30*t)':s=48000:d=0.18`);
graph.push(`[${tick}:a]highpass=f=2500,asplit=${cues.cuts.length}${cues.cuts.map((_, i) => `[ti${i}]`).join("")}`);
cues.cuts.forEach((h, i) => graph.push(`[ti${i}]${at(h - 0.02)},volume=0.3[c${i}]`));
// A riser into the turn and into the name.
const rise = add(`aevalsrc=exprs='(2*random(0)-1)*pow(t/0.9\\,3)':s=48000:d=0.9`);
graph.push(`[${rise}:a]highpass=f=1200,asplit=${cues.risers.length}${cues.risers.map((_, i) => `[ri${i}]`).join("")}`);
cues.risers.forEach((h, i) => graph.push(`[ri${i}]${at(h - 0.9)},volume=0.3[r${i}]`));
// The reminder lands with a ping.
const ping = add(`aevalsrc=exprs='0.6*sin(2*PI*1760*t)*exp(-6*t)+0.35*sin(2*PI*2637*t)*exp(-9*t)':s=48000:d=1.2`);
graph.push(`[${ping}:a]${at(cues.ping)},volume=0.7[pg]`);

const fx = [...booms.map((_, i) => `[b${i}]`), ...cues.crosses.map((_, i) => `[x${i}]`), ...cues.cuts.map((_, i) => `[c${i}]`), ...cues.risers.map((_, i) => `[r${i}]`), "[pg]"];
graph.push(`[voice][ducked]${fx.join("")}amix=inputs=${2 + fx.length}:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11[out]`);

const audio = path.join(outDir, "mix.wav");
const voiceInputs = narration.flatMap(({ id }) => ["-i", path.join(voiceDir, `${id}.wav`)]);
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...voiceInputs, ...inputs,
  "-filter_complex", graph.join(";"), "-map", "[out]", "-ar", "48000", "-t", length.toFixed(3), audio], { stdio: "inherit" });
console.log(`wrote ${audio}`);
if (process.env.AUDIO_ONLY) { await browser.close(); process.exit(0); }

// --- frames ---
const frames = path.join(outDir, "frames");
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames);
const total = Math.round(length * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.renderAt(t), f / FPS);
  await page.screenshot({ path: path.join(frames, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % 300 === 0) console.log(`frame ${f}/${total}`);
}
await browser.close();

// --- mux ---
const film = path.join(outDir, "donna.mp4");
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg"), "-i", audio,
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "192k", "-t", length.toFixed(3), film], { stdio: "inherit" });
console.log(`wrote ${film}`);
