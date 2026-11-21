// Renders film.html to an MP4 with narration.
//
//   node site/build-film.mjs <tts-dir> <out-dir>
//
// <tts-dir> holds one WAV per scene in narration.json plus durations.json, as written by speak.py
// (Kokoro 82M, voice af_heart). Frames are screenshots of film.html at each moment, so the picture
// is locked to the measured length of every spoken line.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [ttsDir, outDir] = process.argv.slice(2);
if (!ttsDir || !outDir) throw new Error("usage: node site/build-film.mjs <tts-dir> <out-dir>");

const FPS = 30;
const narration = JSON.parse(fs.readFileSync(path.join(HERE, "narration.json"), "utf8"));
const measured = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ttsDir, "durations.json"), "utf8")).map((d) => [d.id, d.seconds]));

// Breathing room around each line; the turn lands hard on the hook, and the name holds at the end.
const LEAD = { hook: 0.8, turn: 0.3 };
const TAIL = { hook: 0.15, end: 2.6 };
let clock = 0;
const timeline = narration.map(({ id, text }) => {
  const start = clock;
  const speechStart = start + (LEAD[id] ?? 0.6);
  const speechEnd = speechStart + measured[id];
  const end = speechEnd + (TAIL[id] ?? 0.8);
  clock = end;
  return { id, text, start, speechStart, speechEnd, end };
});
const length = clock;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 1));
console.log(`film length ${length.toFixed(2)}s, ${Math.ceil(length * FPS)} frames`);

// --- frames ---
const frames = path.join(outDir, "frames");
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames);
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.addInitScript((tl) => { window.TIMELINE = tl; }, timeline);
await page.goto(`file://${path.join(HERE, "film.html")}`);
await page.evaluate(() => document.fonts.ready);
const total = Math.ceil(length * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.renderAt(t), f / FPS);
  await page.screenshot({ path: path.join(frames, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % 300 === 0) console.log(`frame ${f}/${total}`);
}
await browser.close();

// --- sound: the voice on its timeline, a low drone under it, a glitch on the turn ---
const voices = timeline.map((s) => path.join(ttsDir, `${s.id}.wav`));
const turnAt = Math.round(timeline.find((s) => s.id === "turn").speechStart * 1000) - 60;
const args = ["-y"];
for (const v of voices) args.push("-i", v);
const bed = voices.length;
args.push("-f", "lavfi", "-i", `sine=f=55:d=${length}`, "-f", "lavfi", "-i", `sine=f=82.41:d=${length}`,
  "-f", "lavfi", "-i", `anoisesrc=d=${length}:c=pink:a=0.5`, "-f", "lavfi", "-i", "anoisesrc=d=0.35:c=white:a=0.6");
const delayed = timeline.map((s, i) => `[${i}:a]adelay=${Math.round(s.speechStart * 1000)}:all=1[v${i}]`);
const filter = [
  ...delayed,
  `${timeline.map((_, i) => `[v${i}]`).join("")}amix=inputs=${voices.length}:normalize=0[voice]`,
  `[${bed}:a][${bed + 1}:a]amix=inputs=2:normalize=0,tremolo=f=0.15:d=0.4,volume=0.05[tones]`,
  `[${bed + 2}:a]lowpass=f=260,volume=0.035[hiss]`,
  `[tones][hiss]amix=inputs=2:normalize=0,afade=t=in:d=2,afade=t=out:st=${(length - 3).toFixed(2)}:d=3[drone]`,
  `[${bed + 3}:a]highpass=f=1800,afade=t=out:st=0.05:d=0.3,volume=0.35,adelay=${turnAt}:all=1[hit]`,
  // Web video sits near -16 LUFS; the raw mix measured -21.6 and would sound weak beside anything
  // else. loudnorm raises it without letting true peaks past -1.5 dBFS.
  `[voice][drone][hit]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
].join(";");
const audio = path.join(outDir, "mix.wav");
args.push("-filter_complex", filter, "-map", "[out]", "-ar", "48000", "-t", String(length), audio);
execFileSync("ffmpeg", args, { stdio: "inherit" });

// --- mux ---
const film = path.join(outDir, "donna.mp4");
execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg"), "-i", audio,
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "160k", "-shortest", film], { stdio: "inherit" });
console.log(`wrote ${film}`);
