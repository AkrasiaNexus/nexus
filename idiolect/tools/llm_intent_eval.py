"""Does Idiolect help a small local model understand what the writer wants?

Each gold message goes to a local model three ways:
  raw             the message as written
  normalized      the message after Idiolect's normalize()
  profile prompt  the message as written, with the profile pasted into the system prompt
The model must answer with exactly one intent label (grammar-constrained, temperature 0).

  pip install llama-cpp-python
  python tools/llm_intent_eval.py run models/*.gguf      # appends to data/llm_intent.jsonl, resumable
  python tools/llm_intent_eval.py report                 # table from the saved predictions, no model needed
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from idiolect import classify, load, normalize  # noqa: E402
from idiolect.evaluate import load_examples, mcnemar_p  # noqa: E402
from idiolect.intents import DESCRIPTIONS  # noqa: E402

DATA = ROOT / "data" / "eval.jsonl"
RESULTS = ROOT / "data" / "llm_intent.jsonl"
PROFILE = load(*(ROOT / "profiles" / n for n in ("generic.md", "context.md", "me.md")))
CONDITIONS = ("raw", "normalized", "profile prompt")
TASK = (
    "A user sent this message to their AI coding assistant. Classify what the message is doing with exactly one label:\n"
    + "\n".join(f"- {label}: {desc}" for label, desc in DESCRIPTIONS.items())
    + "\nAnswer with the label only."
)


def build(condition: str, text: str) -> list[dict]:
    system = TASK + ("\n\nHow this user writes:\n\n" + PROFILE.prompt() if condition == "profile prompt" else "")
    user = normalize(text, PROFILE).text if condition == "normalized" else text
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def run(model_paths: list[str]) -> None:
    from llama_cpp import Llama, LlamaGrammar

    grammar = LlamaGrammar.from_string("root ::= " + " | ".join(f'"{label}"' for label in DESCRIPTIONS), verbose=False)
    done = {(r["model"], r["condition"], r["id"]) for r in _results()}
    examples = load_examples(DATA)
    for path in model_paths:
        name = Path(path).stem
        llm = Llama(model_path=path, n_ctx=4096, n_threads=4, seed=0, verbose=False)
        # One condition at a time, so the shared system prompt stays in the KV cache.
        for condition in CONDITIONS:
            for ex in examples:
                if (name, condition, ex.id) in done:
                    continue
                out = llm.create_chat_completion(build(condition, ex.text), grammar=grammar, temperature=0, max_tokens=4)
                row = {"model": name, "condition": condition, "id": ex.id, "pred": out["choices"][0]["message"]["content"].strip()}
                with RESULTS.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(row) + "\n")
            print(f"{name} {condition}: done", file=sys.stderr)


def _results() -> list[dict]:
    return [json.loads(line) for line in RESULTS.read_text(encoding="utf-8").splitlines() if line.strip()] if RESULTS.exists() else []


def report() -> str:
    examples = load_examples(DATA)
    gold = {ex.id: ex.intent for ex in examples}
    unseen = [ex.id for ex in examples if ex.split == "test2"]
    preds: dict[tuple[str, str], dict[str, str]] = {}
    for r in _results():
        preds.setdefault((r["model"], r["condition"]), {})[r["id"]] = r["pred"]

    def acc(p: dict[str, str], ids: list[str]) -> str:
        return f"{sum(p.get(i) == gold[i] for i in ids)}/{len(ids)}"

    rules = {ex.id: classify(ex.text, PROFILE).label for ex in examples}
    lines = ["| Model | Input | all 37 | test2 (unseen) | vs raw: fixed / broke | p |", "|---|---|---|---|---|---|",
             f"| hand-written rules | normalized | {acc(rules, list(gold))} | {acc(rules, unseen)} | | |"]
    for model in sorted({m for m, _ in preds}, key=lambda m: float(m.split("-")[1].rstrip("b"))):
        raw = preds.get((model, "raw"), {})
        for condition in CONDITIONS:
            p = preds.get((model, condition), {})
            cells = ["", ""]
            if condition != "raw":
                fixed = sum(raw.get(i) != gold[i] and p.get(i) == gold[i] for i in gold)
                broke = sum(raw.get(i) == gold[i] and p.get(i) != gold[i] for i in gold)
                cells = [f"+{fixed} / -{broke}", f"{mcnemar_p(fixed, broke):.2f}"]
            lines.append(f"| {model} | {condition} | {acc(p, list(gold))} | {acc(p, unseen)} | " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    if sys.argv[1:2] == ["run"]:
        run(sys.argv[2:])
    print(report())
