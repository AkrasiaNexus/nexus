// Inlines Campfire into a single-file app between marker comments:
//   /* campfire:start */ ... /* campfire:end */
// so the app needs no module loader and Campfire stays the one source of truth.
//   node tools/bundle.js ../lore/prototype.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const START = "/* campfire:start */";
const END = "/* campfire:end */";

export function bundle() {
  const body = ["crdt.js", "code.js"]
    .map((f) => fs.readFileSync(path.join(SRC, f), "utf8"))
    .join("\n")
    .replace(/^import .*$/gm, "")
    .replace(/^export (?=(async )?function|const|let)/gm, "");
  const api = ["emptyState", "newReplicaId", "addEntry", "setNote", "removeEntry", "explore", "merge", "visibleEntries", "encode", "decode", "validate"];
  return `${START}\n// Generated from campfire/src by campfire/tools/bundle.js. Edit the source, not this block.\nconst Campfire = (() => {\n${body}\nreturn { ${api.join(", ")} };\n})();\n${END}`;
}

export function inject(file) {
  const html = fs.readFileSync(file, "utf8");
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1) throw new Error(`${file} has no ${START} ... ${END} block`);
  fs.writeFileSync(file, html.slice(0, a) + bundle() + html.slice(b + END.length));
}

if (process.argv[2]) {
  inject(path.resolve(process.argv[2]));
  console.log(`Campfire bundled into ${process.argv[2]}`);
}
