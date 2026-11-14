import { PrismaClient, type WasteType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GUIDE } from "../src/lib/waste";
import { earnedBadges } from "../src/lib/rewards";

const db = new PrismaClient();
const DEMO_PASSWORD = "eco12345";

// Deterministic pseudo-random so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
let idSeq = 100000;
const mid = (prefix: string) => `${prefix}-${++idSeq}`;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

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

  const sara = await db.user.create({ data: { memberId: mid("PAR"), name: "Sara Ahmed", email: "sara@eco.demo", passwordHash: hash, role: "PARENT", avatar: "👩" } });
  const core = await Promise.all([
    db.user.create({ data: { memberId: "STU-100001", name: "Ayaan Sharma", email: "ayaan@eco.demo", passwordHash: hash, role: "STUDENT", grade: "Class 10", schoolId: sunrise.id, avatar: "🧑‍🎓" } }),
    db.user.create({ data: { memberId: mid("STU"), name: "Zara Ahmed", email: "zara@eco.demo", passwordHash: hash, role: "STUDENT", grade: "Grade 7", schoolId: sunrise.id, parentId: sara.id, avatar: "👩‍🎓" } }),
    db.user.create({ data: { memberId: "EMP-100003", name: "Rohan Mehta", email: "rohan@eco.demo", passwordHash: hash, role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" } }),
    db.user.create({ data: { memberId: mid("ADM"), name: "Ms. Priya Nair", email: "priya@eco.demo", passwordHash: hash, role: "SCHOOL_ADMIN", schoolId: sunrise.id, avatar: "🏫" } }),
    db.user.create({ data: { memberId: mid("COM"), name: "Dubai Green Community", email: "community@eco.demo", passwordHash: hash, role: "COMMUNITY", community: "Dubai Green Community", avatar: "🌍" } }),
    db.user.create({ data: { memberId: mid("SUP"), name: "Admin Master", email: "admin@eco.demo", passwordHash: adminHash, role: "SUPER_ADMIN", avatar: "👑" } }),
    db.user.create({ data: { memberId: "STF-100008", name: "Daniel Brooks", email: "daniel@eco.demo", passwordHash: hash, role: "TEACHER", grade: "Class 10", schoolId: sunrise.id, avatar: "🧑‍🏫" } }),
    db.user.create({ data: { memberId: mid("HLT"), name: "Nurse Fatima Ali", email: "nurse@eco.demo", passwordHash: hash, role: "HEALTH_MONITOR", grade: "Class 10", schoolId: sunrise.id, avatar: "🩺" } }),
    db.user.create({ data: { memberId: mid("EMP"), name: "Anita Rao", email: "anita@eco.demo", passwordHash: hash, role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" } }),
    db.user.create({ data: { memberId: mid("EMP"), name: "Karim Haddad", email: "karim@eco.demo", passwordHash: hash, role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" } }),
  ]);
  const [ayaan, zara, , , community, , teacher, nurse] = core;

  const names = ["Aisha", "Omar", "Leo", "Mira", "Kabir", "Noor", "Ethan", "Fatima", "Arjun", "Lina", "Yusuf", "Maya", "Dev", "Hana", "Sami", "Riya"];
  const extras = await Promise.all(names.map((n, i) => db.user.create({
    data: {
      memberId: mid("STU"), name: `${n} ${pick(["K.", "R.", "S.", "M.", "A."])}`, email: `${n.toLowerCase()}@eco.demo`, passwordHash: hash,
      role: "STUDENT", grade: i % 3 === 1 ? "Class 10" : `Grade ${6 + (i % 6)}`, schoolId: i % 3 ? sunrise.id : valley.id, avatar: pick(["🦊", "🐢", "🌻", "🌱"]),
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
    db.challenge.create({ data: { title: "Reduce Food Waste", description: "Scan and compost 2 kg of food scraps instead of binning them.", wasteType: "ORGANIC", targetKg: 2, rewardPoints: 100, endsAt: inDays(14) } }),
    db.challenge.create({ data: { title: "Plastic-Free Week", description: "Recycle 1 kg of plastic and switch to a reusable bottle.", wasteType: "PLASTIC", targetKg: 1, rewardPoints: 80, endsAt: inDays(7) } }),
    db.challenge.create({ data: { title: "E-waste Drive", description: "Bring old gadgets to the school e-waste box.", wasteType: "EWASTE", targetKg: 1, rewardPoints: 150, endsAt: inDays(21) } }),
  ]);
  await db.challengeJoin.create({ data: { userId: ayaan.id, challengeId: challenges[0].id, completed: true, completedAt: ago(1), joinedAt: ago(10) } });
  await db.challengeJoin.create({ data: { userId: ayaan.id, challengeId: challenges[1].id } });
  await db.user.update({ where: { id: ayaan.id }, data: { points: { increment: challenges[0].rewardPoints } } });
  // A past purchase, like the mockup's "Purchased: Eco Tote Bag".
  const tote = await db.listing.findFirstOrThrow({ where: { title: "Eco Tote Bag" } });
  await db.purchase.create({ data: { userId: ayaan.id, listingId: tote.id, points: tote.pricePoints, createdAt: ago(2) } });
  await db.listing.update({ where: { id: tote.id }, data: { stock: { decrement: 1 } } });
  await db.user.update({ where: { id: ayaan.id }, data: { points: { decrement: tote.pricePoints } } });

  // Health & safety reports: one recent alert for Class 10, older ones all clear.
  const classes = Array.from(new Set(extras.map((e) => e.grade!).concat("Class 10", "Grade 7")));
  await db.healthReport.createMany({
    data: [
      ...classes.flatMap((c) => [3, 2, 1].map((d) => ({ schoolId: sunrise.id, className: c, reporterId: nurse.id, airQuality: "GOOD", temperatureC: 23 + Math.round(rand() * 4), hygiene: 4, cleaning: "CLEAN", wasteLevel: pick(["LOW", "MEDIUM"]), present: 27 + Math.floor(rand() * 3), total: 30, createdAt: ago(d) }))),
      { schoolId: sunrise.id, className: "Class 10", reporterId: nurse.id, airQuality: "MODERATE", temperatureC: 31, hygiene: 3, cleaning: "NEEDS_CLEANING", wasteLevel: "FULL", present: 26, total: 30, incident: "", createdAt: ago(0.1) },
      { schoolId: sunrise.id, className: "Grade 7", reporterId: nurse.id, airQuality: "GOOD", temperatureC: 24, hygiene: 4, cleaning: "CLEAN", wasteLevel: "MEDIUM", present: 29, total: 30, incident: "Minor spill in the lab, cleaned up", createdAt: ago(0.2) },
    ],
  });

  // Teacher tasks
  const task1 = await db.task.create({ data: { title: "Bring 3 clean plastic bottles", description: "We're building a bottle greenhouse for the school garden.", className: "Class 10", schoolId: sunrise.id, points: 20, dueAt: new Date(Date.now() + 3 * DAY), creatorId: teacher.id } });
  const class10 = extras.filter((e) => e.grade === "Class 10");
  await db.taskDone.createMany({ data: class10.slice(0, 3).map((s, i) => ({ taskId: task1.id, userId: s.id, approved: i === 0 })) });

  // Events, workshops, campaigns, recycling programs
  const at = (d: number, h: number) => { const x = new Date(Date.now() + d * DAY); x.setHours(h, 0, 0, 0); return x; };
  const events = await Promise.all([
    db.event.create({ data: { kind: "EVENT", title: "Green Expo 2026", description: "Swap, repair and upcycle stalls plus a recycling quiz.", location: "Community Hall", startsAt: at(2, 10), organizerId: community.id } }),
    db.event.create({ data: { kind: "WORKSHOP", title: "Upcycling Workshop: Bottle Planters", description: "Turn plastic bottles into self-watering planters.", location: "Sunrise High · Art Room", startsAt: at(4, 14), schoolId: sunrise.id, organizerId: teacher.id } }),
    db.event.create({ data: { kind: "CAMPAIGN", title: "Zero Plastic Lunch Week", description: "Bring lunch in reusable boxes all week.", location: "Sunrise High", startsAt: at(6, 8), schoolId: sunrise.id, organizerId: core[3].id } }),
    db.event.create({ data: { kind: "PROGRAM", title: "Monthly E-waste Collection Drive", description: "Drop old phones, chargers and batteries for safe recycling.", location: "City Recycling Centre", startsAt: at(9, 9), organizerId: community.id } }),
    db.event.create({ data: { kind: "WORKSHOP", title: "Home Composting 101", description: "Learn to turn food scraps into rich soil.", location: "Community Garden", startsAt: at(12, 17), organizerId: community.id } }),
  ]);
  await db.eventRsvp.createMany({ data: [ayaan, zara, ...extras.slice(0, 6)].map((u) => ({ eventId: events[0].id, userId: u.id })).concat({ eventId: events[1].id, userId: ayaan.id }) });

  // Peer marketplace listings
  await db.listing.createMany({
    data: [
      { kind: "DONATE", title: "Grade 9 Science Textbook", description: "Good condition, a few highlights.", category: "Donate", emoji: "📚", pricePoints: 0, stock: 1, ownerId: extras[0].id },
      { kind: "SELL", title: "Kids Bicycle", description: "Outgrown, works perfectly. Pick up at school gate.", category: "Reuse", emoji: "🚲", pricePoints: 120, stock: 1, ownerId: community.id },
      { kind: "EXCHANGE", title: "Board Games Bundle", description: "Swap for any puzzles or books.", category: "Others", emoji: "🧸", pricePoints: 0, stock: 1, ownerId: extras[2].id },
    ],
  });

  await db.notification.createMany({
    data: [
      { kind: "PICKUP", title: "Waste collection tomorrow at 9 AM", body: "Put sorted bins out by 8:30 AM.", createdAt: new Date(Date.now() - 2 * 3_600_000) },
      { kind: "CHALLENGE", title: "New challenge: Reduce Food Waste", body: "Compost 2 kg of food scraps to earn 100 points.", createdAt: new Date(Date.now() - 86_400_000) },
      { kind: "ANNOUNCEMENT", title: "School achieved 85% recycling rate!", body: "Amazing work, Sunrise High School.", createdAt: new Date(Date.now() - 86_400_000) },
      { kind: "EVENT", title: "Community event: Green Expo 2026", body: "Swap, repair and upcycle stalls this Saturday.", createdAt: new Date(Date.now() - 2 * 86_400_000) },
      { userId: sara.id, kind: "HEALTH", title: "Health & safety alert · Grade 7", body: "Incident: Minor spill in the lab, cleaned up", createdAt: ago(0.2) },
      { userId: sara.id, kind: "ANNOUNCEMENT", title: "Parent-teacher eco meeting", body: "Thursday 4 PM, school library. All parents welcome.", createdAt: ago(1) },
      { userId: ayaan.id, kind: "TASK", title: "New task: Bring 3 clean plastic bottles", body: "Due in 3 days · +20 pts", createdAt: ago(0.5) },
    ],
  });
  // Backdate badges the demo users already qualify for, so history shows realistic dates.
  for (const u of await db.user.findMany({ include: { scans: { select: { wasteType: true } }, purchases: true, joins: { where: { completed: true } } } })) {
    const badges = earnedBadges({ scans: u.scans.length, points: u.points, types: new Set(u.scans.map((s) => s.wasteType)).size, purchases: u.purchases.length, challenges: u.joins.length });
    await db.userBadge.createMany({ data: badges.map((b, i) => ({ userId: u.id, badgeId: b.id, earnedAt: ago(25 - i * 3 - rand() * 2) })) });
  }
  console.log(`Seeded. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().finally(() => db.$disconnect());
