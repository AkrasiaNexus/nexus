# Scanner accuracy

The scanner runs CLIP ViT-B/32 (q4) on the phone. A small trained head (`src/lib/scannerHead.json`, a linear layer
over the image embedding, ~35 KB) picks the bin. It is blended 80/20 with CLIP zero-shot, so items missing from the
training photos (books, phones, cables) still get a sensible guess.

## Results (Nov 2026, held-out photos never seen in training)

| Test set | Before (zero-shot) | After (trained head) | Right answer in top 2 |
|---|---|---|---|
| Clean / web photos (2,073) | 75.9% | 94.4% | 97.9% |
| **Real-world litter, TACO (1,886)** | **49.4%** | **71.3%** | **~87%** |

Real-world per bin (after): plastic 78%, other 74%, metal 71%, paper 40%, glass 25%. Glass and paper are mostly
shards and scraps on the ground in TACO; a whole bottle or box held up to the camera is easier.

When the top answer is under 50% sure, the app asks "Which is it?" with the top two bins. On real-world shots
that's about 1 in 7 scans.

**Known gaps:** e-waste training photos are batteries only, so phones, laptops and cables rely on zero-shot.
Food/organic has few real-world photos. Your own real-world photo test (see DEPLOY_CHECKLIST.md) is the number that counts.

## How it keeps learning

1. Logging a scan sends the photo's 512-number CLIP fingerprint (never the photo), the model's guess and the bin
   the user confirmed: `log_scan_feedback` RPC, table `scan_feedback` (super-admin read only, 60/hour cap, validated).
2. Retrain any time: `npx tsx scripts/retrain-scanner.mts` (`--dry` to just score). It mixes the replay set
   (`scripts/data/scanner-replay.bin`, 8,843 public-dataset fingerprints) with feedback (max 200 rows per user,
   weighted ×2), holds out 1 in 5 feedback rows, and only writes a new head if it's not worse on those real scans.
3. Commit `src/lib/scannerHead.json` and redeploy.

## Training data and credits

- [omasteam/waste-garbage-management-dataset](https://huggingface.co/datasets/omasteam/waste-garbage-management-dataset) (MIT): ~19.7k web photos, 10 classes.
- [mnemoraorg/256x256-litter-sort-annotated-wastes](https://huggingface.co/datasets/mnemoraorg/256x256-litter-sort-annotated-wastes) (ECL-2.0): ~6.3k photos, 6 classes.
- [TACO: Trash Annotations in Context](http://tacodataset.org) by Pedro F. Proença and Pedro Simões (CC BY 4.0), via
  [RandyHuynh5815/TACO-Waste-Recognition](https://huggingface.co/datasets/RandyHuynh5815/TACO-Waste-Recognition): 1,500 real-world litter photos;
  each labelled object was cropped. Split by source photo: half for training, half for the real-world test.

Training images got one (web) or two (TACO) extra "phone-shot" copies: random crop and tilt, exposure, colour cast,
blur, noise and JPEG artefacts. Classes were balanced, and real-world crops weighted ×3.
