"""Synthesise the narration for the film: one WAV per line of narration.json, plus durations.json.

    python speak.py <model-dir> <out-dir>

<model-dir> holds kokoro-v1.0.onnx and voices-v1.0.bin from the kokoro-onnx releases.
Kokoro 82M (Apache 2.0), voice af_heart, runs on a CPU.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

model_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
kokoro = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
here = os.path.dirname(os.path.abspath(__file__))
lines = json.load(open(os.path.join(here, "narration.json")))

measured = []
for line in lines:
    samples, rate = kokoro.create(line["text"], voice="af_heart", speed=0.98, lang="en-us")
    sf.write(os.path.join(out_dir, f"{line['id']}.wav"), samples, rate)
    measured.append({"id": line["id"], "seconds": round(len(samples) / rate, 3), "peak": round(float(np.abs(samples).max()), 3)})

json.dump(measured, open(os.path.join(out_dir, "durations.json"), "w"), indent=1)
print(f"{len(measured)} lines, {sum(m['seconds'] for m in measured):.1f}s of speech")
