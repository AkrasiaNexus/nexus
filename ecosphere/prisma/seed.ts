import { PrismaClient, type WasteType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GUIDE } from "../src/lib/waste";

const db = new PrismaClient();
const DEMO_PASSWORD = "eco12345";

// Deterministic pseudo-random so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const ITEMS: [string, WasteType][] = [
  ["water bottle", "PLASTIC"], ["pop bottle", "PLASTIC"], ["carton", "PAPER"], ["envelope", "PAPER"],
  ["beer bottle", "GLASS"], ["tin can", "METAL"], ["banana", "ORGANIC"], ["orange", "ORGANIC"],
  ["cellular telephone", "EWASTE"], ["jersey", "TEXTILE"], ["plastic bag", "PLASTIC"], ["chip packet", "OTHER"],
];

async function main() {
  if ((await db.user.count()) > 0) return console.log("Seed skipped: data exists.");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const adminHash = process.env.SEED_ADMIN_PASSWORD ? await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10) : hash;

  const sunrise = await db.school.create({ data: { name: "Sunrise High School", city: "Dubai" } });
  const valley = await db.school.create({ data: { name: "Green Valley Academy", city: "Sharjah" } });

  const sara = await db.user.create({ data: { name: "Sara Ahmed", email: "sara@eco.demo", passwordHash: hash, role: "PARENT", avatar: "👩" } });
  const core = await Promise.all([
    db.user.create({ data: { name: "Ayaan Sharma", email: "ayaan@eco.demo", passwordHash: hash, role: "STUDENT", grade: "Class 10", schoolId: sunrise.id, avatar: "🧑‍🎓" } }),
    db.user.create({ data: { name: "Zara Ahmed", email: "zara@eco.demo", passwordHash: hash, role: "STUDENT", grade: "Grade 7", schoolId: sunrise.id, parentId: sara.id, avatar: "👩‍🎓" } }),
    db.user.create({ data: { name: "Rohan Mehta", email: "rohan@eco.demo", passwordHash: hash, role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" } }),
    db.user.create({ data: { name: "Priya Nair", email: "priya@eco.demo", passwordHash: hash, role: "SCHOOL_ADMIN", schoolId: sunrise.id, avatar: "🏫" } }),
    db.user.create({ data: { name: "Dubai Green Community", email: "community@eco.demo", passwordHash: hash, role: "COMMUNITY", community: "Dubai Green Community", avatar: "🌍" } }),
    db.user.create({ data: { name: "Admin Master", email: "admin@eco.demo", passwordHash: adminHash, role: "SUPER_ADMIN", avatar: "👑" } }),
  ]);

  const names = ["Aisha", "Omar", "Leo", "Mira", "Kabir", "Noor", "Ethan", "Fatima", "Arjun", "Lina", "Yusuf", "Maya", "Dev", "Hana", "Sami", "Riya"];
  const extras = await Promise.all(names.map((n, i) => db.user.create({
    data: {
      name: `${n} ${pick(["K.", "R.", "S.", "M.", "A."])}`, email: `${n.toLowerCase()}@eco.demo`, passwordHash: hash,
      role: "STUDENT", grade: `Grade ${6 + (i % 6)}`, schoolId: i % 3 ? sunrise.id : valley.id, avatar: pick(["🦊", "🐢", "🌻", "🌱"]),
    },
  })));

  const scanners = [...core.filter((u) => ["STUDENT", "EMPLOYEE", "COMMUNITY"].includes(u.role)), ...extras];
  for (const u of scanners) {
    const count = u.email === "ayaan@eco.demo" ? 60 : 8 + Math.floor(rand() * 30);
    const scans = Array.from({ length: count }, () => {
      const [label, wasteType] = pick(ITEMS);
      const g = GUIDE[wasteType];
      return {
        userId: u.id, label, wasteType, confidence: 0.6 + rand() * 0.39,
        weightKg: Math.round(g.defaultKg * (0.5 + rand() * 4) * 100) / 100 + 0.1,
        points: g.points, createdAt: new Date(Date.now() - rand() * 30 * 86_400_000),
      };
    });
    await db.scan.createMany({ data: scans });
    await db.user.update({ where: { id: u.id }, data: { points: scans.reduce((s, x) => s + x.points, 0) } });
  }

  await db.listing.createMany({
    data: [
      { title: "Reusable Water Bottle", description: "Steel, 750ml. Ditch single-use plastic.", category: "Reuse", emoji: "🧴", pricePoints: 200, stock: 25 },
      { title: "Eco Tote Bag", description: "Organic cotton shopping bag.", category: "Reuse", emoji: "👜", pricePoints: 150, stock: 40 },
      { title: "Plant Pot", description: "Upcycled pot with a seedling.", category: "Reuse", emoji: "🪴", pricePoints: 250, stock: 15 },
      { title: "Used Books Bundle", description: "Donated textbooks, gently used.", category: "Donate", emoji: "📚", pricePoints: 100, stock: 20 },
      { title: "School Uniform (donated)", description: "Clean, pre-loved uniform sets.", category: "Donate", emoji: "👕", pricePoints: 80, stock: 12 },
      { title: "Compost Starter Kit", description: "Turn food scraps into soil.", category: "Others", emoji: "🪱", pricePoints: 300, stock: 10 },
      { title: "Bamboo Cutlery Set", description: "Carry-anywhere cutlery.", category: "Reuse", emoji: "🥢", pricePoints: 120, stock: 30 },
      { title: "Plant a Tree", description: "We plant a tree on your behalf.", category: "Others", emoji: "🌳", pricePoints: 500, stock: 100 },
    ],
  });

  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);
  const challenges = await Promise.all([
    db.challenge.create({ data: { title: "Reduce Food Waste", description: "Log and compost 2 kg of food scraps instead of binning them.", wasteType: "ORGANIC", targetKg: 2, rewardPoints: 100, endsAt: inDays(14) } }),
    db.challenge.create({ data: { title: "Plastic-Free Week", description: "Recycle 1 kg of plastic and switch to a reusable bottle.", wasteType: "PLASTIC", targetKg: 1, rewardPoints: 80, endsAt: inDays(7) } }),
    db.challenge.create({ data: { title: "E-waste Drive", description: "Bring old gadgets to the school e-waste box.", wasteType: "EWASTE", targetKg: 1, rewardPoints: 150, endsAt: inDays(21) } }),
  ]);
  await db.challengeJoin.create({ data: { userId: core[0].id, challengeId: challenges[0].id } });

  await db.notification.createMany({
    data: [
      { kind: "PICKUP", title: "Waste collection tomorrow at 9 AM", body: "Put sorted bins out by 8:30 AM.", createdAt: new Date(Date.now() - 2 * 3_600_000) },
      { kind: "CHALLENGE", title: "New challenge: Reduce Food Waste", body: "Compost 2 kg of food scraps to earn 100 points.", createdAt: new Date(Date.now() - 86_400_000) },
      { kind: "ANNOUNCEMENT", title: "School achieved 85% recycling rate!", body: "Amazing work, Sunrise High School.", createdAt: new Date(Date.now() - 86_400_000) },
      { kind: "EVENT", title: "Community event: Green Expo 2026", body: "Swap, repair and upcycle stalls this Saturday.", createdAt: new Date(Date.now() - 2 * 86_400_000) },
    ],
  });
  console.log(`Seeded. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().finally(() => db.$disconnect());
