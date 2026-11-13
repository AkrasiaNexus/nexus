import type { WasteType } from "@prisma/client";

export const WASTE_TYPES = ["PLASTIC", "PAPER", "GLASS", "METAL", "ORGANIC", "EWASTE", "TEXTILE", "OTHER"] as const;

type Guide = {
  name: string;
  emoji: string;
  bin: string;
  binColor: string;
  steps: string[];
  avoid: string[];
  fact: string;
  defaultKg: number;
  co2PerKg: number; // kg CO2e avoided per kg diverted from landfill
  waterPerKg: number; // litres of water saved per kg
  points: number;
};

// Approximate factors drawn from common LCA estimates (EPA WARM-style); good for awareness, not audits.
export const GUIDE: Record<WasteType, Guide> = {
  PLASTIC: {
    name: "Plastic", emoji: "🧴", bin: "Dry recyclables (blue)", binColor: "#3b82f6",
    steps: ["Empty and rinse it", "Remove caps and labels if possible", "Crush bottles to save space", "Drop in the blue recycling bin"],
    avoid: ["Greasy food containers", "Plastic bags in the bin (return to store drop-off)"],
    fact: "Recycling 1 plastic bottle saves enough energy to power a light bulb for 6 hours.",
    defaultKg: 0.03, co2PerKg: 1.5, waterPerKg: 17, points: 10,
  },
  PAPER: {
    name: "Paper & Card", emoji: "📦", bin: "Dry recyclables (blue)", binColor: "#3b82f6",
    steps: ["Keep it dry and clean", "Flatten cardboard boxes", "Remove tape and staples where easy", "Drop in the blue recycling bin"],
    avoid: ["Tissues and paper towels", "Pizza boxes soaked in grease"],
    fact: "Recycling 1 tonne of paper saves about 17 trees and 26,000 litres of water.",
    defaultKg: 0.1, co2PerKg: 0.9, waterPerKg: 26, points: 10,
  },
  GLASS: {
    name: "Glass", emoji: "🍾", bin: "Glass bank (green)", binColor: "#22c55e",
    steps: ["Rinse it out", "Remove lids (recycle metal lids separately)", "Do not break it", "Take to a glass bank or glass bin"],
    avoid: ["Window glass, mirrors, ceramics", "Light bulbs"],
    fact: "Glass can be recycled endlessly without losing quality.",
    defaultKg: 0.35, co2PerKg: 0.3, waterPerKg: 1.2, points: 10,
  },
  METAL: {
    name: "Metal", emoji: "🥫", bin: "Dry recyclables (blue)", binColor: "#3b82f6",
    steps: ["Rinse cans", "Squash aluminium cans", "Keep lids with the can", "Drop in the blue recycling bin"],
    avoid: ["Aerosols that aren't empty", "Paint tins with paint inside"],
    fact: "Recycling aluminium uses 95% less energy than making it new.",
    defaultKg: 0.015, co2PerKg: 4, waterPerKg: 40, points: 10,
  },
  ORGANIC: {
    name: "Food & Organic", emoji: "🍌", bin: "Compost / wet waste (brown)", binColor: "#a16207",
    steps: ["Scrape leftovers into the compost bin", "No plastic packaging", "Use it for home compost if you can", "Plan portions to cut waste next time"],
    avoid: ["Meat and dairy in home compost", "Compostable plastics in home compost"],
    fact: "About a third of all food produced is wasted. Composting stops it turning into methane in landfill.",
    defaultKg: 0.2, co2PerKg: 0.5, waterPerKg: 0, points: 10,
  },
  EWASTE: {
    name: "E-waste", emoji: "🔋", bin: "E-waste drop-off", binColor: "#f59e0b",
    steps: ["Wipe personal data", "Remove batteries if you can", "Take to an e-waste collection point", "Consider repair or donation first"],
    avoid: ["Never put batteries in the regular bin (fire risk)"],
    fact: "A tonne of old phones contains more gold than a tonne of gold ore.",
    defaultKg: 0.2, co2PerKg: 2, waterPerKg: 10, points: 15,
  },
  TEXTILE: {
    name: "Textiles", emoji: "👕", bin: "Clothing bank / donate", binColor: "#a855f7",
    steps: ["Wash and dry it", "Donate if wearable", "Repurpose worn items as rags", "Take the rest to a textile bank"],
    avoid: ["Wet or mouldy clothes"],
    fact: "Making one cotton T-shirt can take about 2,700 litres of water.",
    defaultKg: 0.3, co2PerKg: 3.6, waterPerKg: 1000, points: 15,
  },
  OTHER: {
    name: "General waste", emoji: "🗑️", bin: "General waste (black)", binColor: "#6b7280",
    steps: ["Check whether any part is recyclable", "Bag it securely", "Put it in the general waste bin"],
    avoid: ["Hazardous items: take them to a hazardous waste site"],
    fact: "The best waste is the waste never created. Choose reusable items where you can.",
    defaultKg: 0.1, co2PerKg: 0, waterPerKg: 0, points: 2,
  },
};

// ImageNet (MobileNet) label keywords -> waste type. Order matters: glass bottles before generic bottles.
const KEYWORDS: [WasteType, string[]][] = [
  ["GLASS", ["beer bottle", "wine bottle", "goblet", "beer glass", "red wine", "vase", "perfume", "jar", "whiskey jug"]],
  ["EWASTE", ["cellular telephone", "cellphone", "laptop", "notebook", "mouse", "computer keyboard", "remote control", "ipod", "monitor", "television", "desktop computer", "hand-held computer", "modem", "joystick", "printer", "loudspeaker", "electric fan", "hair dryer", "toaster", "digital watch", "digital clock", "radio", "cd player", "tape player", "projector", "power drill", "switch", "iron", "microwave", "calculator"]],
  ["ORGANIC", ["banana", "orange", "lemon", "granny smith", "pizza", "broccoli", "cucumber", "mushroom", "strawberry", "pineapple", "corn", "bagel", "pretzel", "hotdog", "cheeseburger", "cabbage", "cauliflower", "zucchini", "bell pepper", "pomegranate", "fig", "jackfruit", "custard apple", "potpie", "burrito", "guacamole", "trifle", "ice cream", "french loaf", "carbonara", "meat loaf", "squash", "artichoke", "plate", "acorn", "egg"]],
  ["TEXTILE", ["jersey", "t-shirt", "sweatshirt", "cardigan", "jean", "sock", "running shoe", "loafer", "boot", "wool", "pajama", "coat", "suit", "tie", "bath towel", "dishrag", "apron", "quilt", "poncho", "kimono", "swimming trunks", "mitten", "sandal", "backpack"]],
  ["METAL", ["can", "tin", "frying pan", "wok", "caldron", "nail", "screw", "chain", "padlock", "safety pin", "ladle", "spatula", "milk can", "ashcan", "bottlecap"]],
  ["PAPER", ["envelope", "carton", "book jacket", "comic book", "menu", "crossword", "binder", "paper", "packet", "toilet tissue"]],
  ["PLASTIC", ["water bottle", "pop bottle", "pill bottle", "plastic bag", "water jug", "bottle", "bucket", "shower cap", "lotion", "soap dispenser", "straw", "lighter"]],
];

const hasWord = (label: string, word: string) =>
  new RegExp(`(^|[^a-z])${word.replace(/[-]/g, "\\-")}([^a-z]|$)`).test(label);

export function mapLabel(className: string): WasteType {
  const label = className.toLowerCase();
  return KEYWORDS.find(([, words]) => words.some((w) => hasWord(label, w)))?.[0] ?? "OTHER";
}

export type Prediction = { className: string; probability: number };
const MIN_MATCH_PROBABILITY = 0.05;

// Pick the most confident prediction that maps to a known waste stream; else fall back to the top guess.
export function classify(predictions: Prediction[]) {
  const hit = predictions.find((p) => p.probability >= MIN_MATCH_PROBABILITY && mapLabel(p.className) !== "OTHER");
  const pick = hit ?? predictions[0];
  if (!pick) return { wasteType: "OTHER" as WasteType, label: "Unknown item", confidence: 0 };
  return {
    wasteType: mapLabel(pick.className),
    label: pick.className.split(",")[0],
    confidence: pick.probability,
  };
}

export const TREE_CO2_KG_PER_YEAR = 21;

export function impact(scans: { wasteType: WasteType; weightKg: number }[]) {
  const kg = scans.reduce((s, x) => s + x.weightKg, 0);
  const recycledKg = scans.filter((x) => x.wasteType !== "OTHER").reduce((s, x) => s + x.weightKg, 0);
  const co2 = scans.reduce((s, x) => s + x.weightKg * GUIDE[x.wasteType].co2PerKg, 0);
  const water = scans.reduce((s, x) => s + x.weightKg * GUIDE[x.wasteType].waterPerKg, 0);
  return {
    kg: round(kg),
    co2: round(co2),
    water: Math.round(water),
    trees: round(co2 / TREE_CO2_KG_PER_YEAR),
    recyclingRate: kg ? Math.round((recycledKg / kg) * 100) : 0,
  };
}

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
