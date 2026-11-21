// Directory of local partners & drop-off points. shortcut: static list, move to DB when admins need to edit it.
export const PARTNERS = [
  { name: "City Municipal Recycling Centre", type: "Recycler", accepts: "Plastic, paper, glass, metal", emoji: "♻️" },
  { name: "E-Waste Collection Point", type: "Recycler", accepts: "Phones, laptops, batteries, cables", emoji: "🔋" },
  { name: "Clothing & Textile Bank", type: "NGO", accepts: "Clean clothes, shoes, linen", emoji: "👕" },
  { name: "Community Food Bank", type: "NGO", accepts: "Surplus sealed food, fresh produce", emoji: "🥫" },
  { name: "Community Compost Hub", type: "Program", accepts: "Fruit & veg scraps, garden waste", emoji: "🪱" },
  { name: "Repair Café", type: "Business", accepts: "Broken gadgets, bikes, clothes to fix", emoji: "🛠️" },
  { name: "Refill & Zero-Waste Store", type: "Business", accepts: "Bring your own containers", emoji: "🫙" },
  { name: "Book Swap Library", type: "NGO", accepts: "Textbooks, novels, comics", emoji: "📚" },
] as const;

export const mapsLink = (q: string) => `https://www.google.com/maps/search/${encodeURIComponent(q + " near me")}`;
