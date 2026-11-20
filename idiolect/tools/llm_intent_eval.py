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
import re
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


def chat_prompt(llm, messages: list[dict]) -> str:
    """The model's own chat template, with thinking off so a one-word answer isn't squeezed out of a thought.

    The template ships inside the downloaded GGUF, so it is rendered in Jinja's sandbox.
    """
    from jinja2.sandbox import ImmutableSandboxedEnvironment

    def fail(message):
        raise ValueError(message)

    template = ImmutableSandboxedEnvironment(trim_blocks=True, lstrip_blocks=True).from_string(
        llm.metadata["tokenizer.chat_template"])
    vocab = llm._model
    # create_completion() adds BOS itself when the model wants one; emitting it here too would double it.
    bos = "" if vocab.add_bos_token() else vocab.token_get_text(vocab.token_bos())
    return template.render(messages=messages, add_generation_prompt=True, enable_thinking=False,
                           bos_token=bos, eos_token=vocab.token_get_text(vocab.token_eos()), raise_exception=fail)


def run(model_paths: list[str]) -> None:
    from llama_cpp import Llama, LlamaGrammar

    grammar = LlamaGrammar.from_string("root ::= " + " | ".join(f'"{label}"' for label in DESCRIPTIONS), verbose=False)
    done = {(r["model"], r["condition"], r["id"]) for r in _results()}
    examples = load_examples(DATA)
    for path in model_paths:
        name = re.sub(r"-\d{5}-of-\d{5}$", "", Path(path).stem)  # split GGUFs: name the model, not part 1
        # n_gpu_layers=-1 puts every layer on the GPU when there is one (Metal on a Mac); a CPU build ignores it.
        llm = Llama(model_path=path, n_ctx=4096, n_gpu_layers=-1, seed=0, verbose=False)
        # One condition at a time, so the shared system prompt stays in the KV cache.
        for condition in CONDITIONS:
            for ex in examples:
                if (name, condition, ex.id) in done:
                    continue
                prompt = chat_prompt(llm, build(condition, ex.text))
                out = llm.create_completion(prompt, grammar=grammar, temperature=0, max_tokens=8)
                row = {"model": name, "condition": condition, "id": ex.id, "pred": out["choices"][0]["text"].strip()}
                with RESULTS.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(row) + "\n")
            print(f"{name} {condition}: done", file=sys.stderr)


def _results() -> list[dict]:
    rows = []
    for line in RESULTS.read_text(encoding="utf-8").splitlines() if RESULTS.exists() else []:
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:  # a run killed mid-write leaves a partial last line
            continue
    return rows


def _size(model: str) -> tuple[float, str]:
    """Sort key: the parameter count in names like qwen2.5-1.5b-instruct; unknown sizes sort last."""
    for part in model.lower().split("-"):
        if part[:-1].replace(".", "", 1).isdigit() and part[-1] in "mb":
            return float(part[:-1]) / (1000 if part[-1] == "m" else 1), model
    return float("inf"), model


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
    for model in sorted({m for m, _ in preds}, key=_size):
        raw = preds.get((model, "raw"), {})
        for condition in CONDITIONS:
            p = preds.get((model, condition), {})
            if len(p) < len(gold) or len(raw) < len(gold):
                lines.append(f"| {model} | {condition} | running ({len(p)}/{len(gold)}) | | | |")
                continue
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
