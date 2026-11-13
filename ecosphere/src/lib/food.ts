export const FOOD_CATEGORIES = { FRUIT_VEG: "🥦 Fruit & veg", GRAINS: "🍚 Rice, pasta & grains", BAKERY: "🍞 Bread & bakery", DAIRY: "🧀 Dairy & eggs", MEAT: "🍗 Meat & fish", COOKED: "🍲 Cooked meals", OTHER: "🍽️ Other" } as const;
export const FOOD_REASONS = { LEFTOVER: "Leftovers", PLATE_WASTE: "Plate waste", EXPIRED: "Expired", SPOILED: "Spoiled", OVERCOOKED: "Cooked too much" } as const;
export const FOOD_DISPOSALS = { COMPOST: "Composted", DONATE: "Donated / shared", ANIMAL_FEED: "Animal feed", BIN: "General bin" } as const;

export type FoodCategory = keyof typeof FOOD_CATEGORIES;

// Leftover-rescue recipes: the "use it up" step before compost.
export const RECIPES: Record<FoodCategory, { name: string; how: string }[]> = {
  FRUIT_VEG: [
    { name: "Smoothie", how: "Blend soft fruit with yoghurt or milk." },
    { name: "Veggie stock", how: "Simmer peels and ends in water for 40 min, strain." },
    { name: "Stir-fry", how: "Slice tired veg, fry hot with garlic and soy." },
  ],
  GRAINS: [
    { name: "Fried rice", how: "Day-old rice fried with egg, veg and soy sauce." },
    { name: "Rice pudding", how: "Simmer cooked rice in milk with sugar and cardamom." },
  ],
  BAKERY: [
    { name: "Breadcrumbs", how: "Dry stale bread in the oven and blitz. Freeze." },
    { name: "French toast", how: "Soak stale slices in egg and milk, pan fry." },
  ],
  DAIRY: [
    { name: "Paneer / cottage cheese", how: "Heat milk about to turn, add lemon juice, strain." },
    { name: "Frittata", how: "Whisk eggs with leftover cheese and veg, bake." },
  ],
  MEAT: [
    { name: "Wraps", how: "Shred leftover meat into wraps with salad." },
    { name: "Soup", how: "Simmer bones and scraps into broth." },
  ],
  COOKED: [
    { name: "Next-day lunchbox", how: "Cool quickly, refrigerate, eat within 2 days." },
    { name: "Freeze portions", how: "Freeze in single portions for busy days." },
  ],
  OTHER: [{ name: "Share it", how: "Offer surplus to neighbours or a community fridge." }],
};

export const FOOD_TIPS = [
  "Plan meals and write a shopping list. Buy only what you need.",
  "First in, first out: move older food to the front of the fridge.",
  "'Best before' is about quality, 'use by' is about safety.",
  "Serve smaller portions. People can always come back for more.",
  "Freeze bread, bananas and leftovers before they spoil.",
];

// About 2.5 kg CO2e per kg of food wasted (production + landfill methane), approximate.
export const FOOD_CO2_PER_KG = 2.5;

export function foodSummary(logs: { kg: number; disposal: string }[]) {
  const total = logs.reduce((s, l) => s + l.kg, 0);
  const diverted = logs.filter((l) => l.disposal !== "BIN").reduce((s, l) => s + l.kg, 0);
  return {
    totalKg: Math.round(total * 10) / 10,
    divertedKg: Math.round(diverted * 10) / 10,
    divertedPct: total ? Math.round((diverted / total) * 100) : 0,
    co2Kg: Math.round(total * FOOD_CO2_PER_KG * 10) / 10,
  };
}
