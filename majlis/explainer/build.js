// Builds explainer/index.html from src.html by inlining Majlis's real routing code,
// so the page runs exactly what the tests verify.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src");
const START = "/* majlis:start */";
const END = "/* majlis:end */";

export function build() {
  const code = ["geo.js", "timetable.js", "raptor.js"]
    .map((f) => fs.readFileSync(path.join(SRC, f), "utf8"))
    .join("\n")
    .replace(/^import .*$/gm, "")
    .replace(/^export (?=(async )?function|const|let)/gm, "");
  const block = `${START}\n// Generated from majlis/src by explainer/build.js.\nconst Majlis = (() => {\n${code}\nreturn { buildTimetable, raptor, journeyTo };\n})();\n${END}`;
  const html = fs.readFileSync(path.join(HERE, "src.html"), "utf8");
  const out = html.replace(`${START}\n${END}`, block);
  if (out === html) throw new Error("src.html is missing the majlis markers");
  fs.writeFileSync(path.join(HERE, "index.html"), out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build();
  console.log("Built explainer/index.html");
}
