import type { WasteType } from "./types";
import { GUIDE, WASTE_TYPES } from "./waste";

// Guide topics = every waste type + FOOD, which is guide-only (food waste is not tracked or scored).
export type Topic = WasteType | "FOOD";
export const TOPICS: readonly Topic[] = [...WASTE_TYPES.slice(0, 4), "FOOD", ...WASTE_TYPES.slice(4)];

type Info = { name: string; summary: string; emoji: string; bin: string; binColor: string; steps: string[]; avoid: string[]; fact: string };

const FOOD: Info = {
  name: "Food waste", summary: "Prevent it first: plan, store well, share surplus. Compost what's left.", emoji: "🥗",
  bin: "Compost / wet waste (brown)", binColor: "#a16207",
  steps: ["Plan meals and buy only what you'll eat", "Store food properly: first in, first out", "Freeze leftovers or turn them into new meals", "Share surplus with friends, neighbours or a food bank", "Compost peels and scraps"],
  avoid: ["Throwing out food just because of a 'best before' date (check it)", "Bagging food scraps in plastic"],
  fact: "Food waste causes about 8–10% of global greenhouse gas emissions.",
};

export const info = (t: Topic): Info => (t === "FOOD" ? FOOD : GUIDE[t]);
export const shortName = (t: Topic) => info(t).name.replace(" & Card", "").replace("Food & ", "");

export const EXAMPLES: Record<Topic, string[]> = {
  PLASTIC: ["Water bottles", "Shampoo bottles", "Yoghurt tubs", "Clean takeaway boxes", "Milk jugs"],
  PAPER: ["Newspapers", "Cereal boxes", "Envelopes", "Exercise books", "Cardboard boxes"],
  GLASS: ["Jam jars", "Sauce bottles", "Drink bottles", "Perfume bottles"],
  METAL: ["Drink cans", "Food tins", "Clean foil", "Metal lids", "Empty aerosols"],
  FOOD: ["Leftover meals", "Stale bread", "Overripe fruit", "Unopened packaged food"],
  ORGANIC: ["Fruit and veg peels", "Tea bags", "Coffee grounds", "Eggshells", "Garden leaves"],
  EWASTE: ["Phones", "Chargers and cables", "Batteries", "Headphones", "Old laptops"],
  TEXTILE: ["T-shirts", "Jeans", "Shoes in pairs", "Bed sheets", "School uniforms"],
  OTHER: ["Crisp packets", "Used tissues", "Nappies", "Broken ceramics", "Chewing gum"],
};

export const REUSE: Record<Topic, string[]> = {
  PLASTIC: ["Turn bottles into self-watering planters", "Use tubs for storing stationery"],
  PAPER: ["Use one-sided sheets as notepads", "Shred card for compost or packing"],
  GLASS: ["Jars make great food storage and pen pots", "Turn bottles into lamps or vases"],
  METAL: ["Tins become pencil holders or herb pots", "Donate old cookware"],
  FOOD: ["Blend overripe bananas into smoothies or banana bread", "Turn stale bread into croutons or breadcrumbs", "Cook a 'fridge clear-out' meal once a week"],
  ORGANIC: ["Regrow spring onions and celery from scraps", "Make veggie stock from peels"],
  EWASTE: ["Sell or donate working phones", "Use old phones as webcams or music players"],
  TEXTILE: ["Cut old T-shirts into cleaning rags", "Swap clothes at a community event"],
  OTHER: ["Choose products with less packaging next time", "Ask shops about refill options"],
};

// Case-insensitive match on name, summary and examples; a matched example is returned as the reason.
export function searchGuide(q: string): { topic: Topic; hit?: string }[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return TOPICS.flatMap((t) => {
    const hit = EXAMPLES[t].find((e) => e.toLowerCase().includes(s));
    const i = info(t);
    return hit || i.name.toLowerCase().includes(s) || i.summary.toLowerCase().includes(s) ? [{ topic: t, hit }] : [];
  });
}
