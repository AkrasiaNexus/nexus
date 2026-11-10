import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { run } from "../bin/majlis.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TINY = path.join(HERE, "fixtures", "tiny");
const base = ["--gtfs", TINY, "--date", "20261111", "--time", "08:05"];

test("ranks Charlie first for a rider at the bus station and one next to Echo", () => {
  const out = run([...base, "--person", "Ali@24.45,54.30", "--person", "Eve@24.45,54.342"]);
  const first = out.split("\n\n")[0];
  assert.match(first, /^1\. Charlie {2}\(longest trip 15 min/);
  assert.match(first, /Ali: 15 min, bus 54 08:10 Bus Station, Al Wahda → Charlie 08:20/);
  assert.match(first, /Eve: \d+ min, walk the whole way/);
});

test("rejects bad input with a clear message", () => {
  assert.throws(() => run([...base, "--person", "Ali@24.45,54.30"]), /at least two --person/);
  assert.throws(() => run([...base, "--person", "Ali", "--person", "Eve@1,2"]), /Name@lat,lon/);
  assert.throws(() => run(["--gtfs", TINY, "--date", "2026-11-11", "--time", "08:05"]), /YYYYMMDD/);
  assert.throws(() => run([...base, "--objective", "cheapest", "--person", "A@1,2", "--person", "B@1,2"]), /fairest or fastest/);
});

test("works as a command", () => {
  const out = execFileSync(process.execPath, [path.join(HERE, "..", "bin", "majlis.js"), ...base, "--person", "Ali@24.45,54.30", "--person", "Eve@24.45,54.342", "--top", "1"], { encoding: "utf8" });
  assert.match(out, /^1\. Charlie/);
});
