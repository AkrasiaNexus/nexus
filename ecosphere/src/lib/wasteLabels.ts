import type { WasteType } from "./types";

// Plain-English descriptions the on-device CLIP model compares a photo against (zero-shot).
// Several phrasings per type; a type's score is the total over its phrasings.
export const WASTE_PROMPTS: Record<WasteType, string[]> = {
  PLASTIC: ["a plastic water bottle", "a plastic bottle", "a plastic bag", "a plastic food container", "a yoghurt pot", "plastic packaging"],
  PAPER: ["a cardboard box", "a stack of paper", "a newspaper", "a book", "a paper bag", "a cereal box"],
  GLASS: ["a glass bottle", "a glass jar", "a wine bottle", "a drinking glass"],
  METAL: ["an aluminium drink can", "a tin can", "a metal water bottle", "a metal pot or pan", "aluminium foil"],
  ORGANIC: ["food scraps", "a banana peel", "fruit and vegetable waste", "leftover food", "leaves and garden waste", "a potted plant"],
  EWASTE: ["a mobile phone", "a battery", "a laptop", "electronic cables and chargers", "headphones", "an electronic device"],
  TEXTILE: ["a t-shirt", "clothes", "a tote bag", "a pair of shoes", "a piece of fabric"],
  OTHER: ["a crisp packet", "a used tissue", "a broken ceramic plate", "general rubbish"],
};

export const PROMPT_LIST = Object.entries(WASTE_PROMPTS).flatMap(([type, prompts]) => prompts.map((p) => ({ type: type as WasteType, prompt: p })));
