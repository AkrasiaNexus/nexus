// Demo data for EcoSphere on Supabase. Usage: npm run seed            (skips if data exists)
//                                          npm run seed -- --reset  (wipes demo data first)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.
import { createClient } from "@supabase/supabase-js";
import { GUIDE } from "../src/lib/waste";
import { earnedBadges } from "../src/lib/rewards";
import type { Role, WasteType } from "../src/lib/types";

try { process.loadEnvFile(".env"); } catch { /* env may come from the shell (e.g. Vercel) */ }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const DEMO_PASSWORD = "eco12345";
const DEMO_DOMAIN = "@eco.demo";
let state = 42; // deterministic pseudo-random so every seed looks the same
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
let idSeq = 100000;
const mid = (prefix: string) => `${prefix}-${++idSeq}`;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase rows
type Row = Record<string, any>;
async function ins(table: string, rows: Row | Row[]) {
  const list = Array.isArray(rows) ? rows : [rows];
  const { data, error } = await db.from(table).insert(list, { defaultToNull: false }).select(); // missing fields take column defaults
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as Row[];
}

type NewUser = { email: string; name: string; role: Role; memberId?: string; grade?: string; schoolId?: string; parentId?: string; department?: string; community?: string; avatar: string; password?: string };
async function user(u: NewUser) {
  const { data, error } = await db.auth.admin.createUser({ email: u.email, password: u.password ?? DEMO_PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`auth ${u.email}: ${error?.message}`);
  const { password: _pw, ...profile } = u;
  void _pw;
  return (await ins("profiles", { ...profile, id: data.user.id, memberId: u.memberId ?? mid(u.role.slice(0, 3)) }))[0];
}

const ITEMS: [string, WasteType][] = [
  ["water bottle", "PLASTIC"], ["pop bottle", "PLASTIC"], ["carton", "PAPER"], ["envelope", "PAPER"],
  ["beer bottle", "GLASS"], ["tin can", "METAL"], ["banana", "ORGANIC"], ["orange", "ORGANIC"],
  ["cellular telephone", "EWASTE"], ["jersey", "TEXTILE"], ["plastic bag", "PLASTIC"], ["chip packet", "OTHER"],
];

async function reset() {
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const demo = (data?.users ?? []).filter((u) => u.email?.endsWith(DEMO_DOMAIN) || u.email?.endsWith("@eco.test"));
    for (const u of demo) await db.auth.admin.deleteUser(u.id); // profiles + personal rows cascade
    if ((data?.users.length ?? 0) < 200) break;
  }
  for (const t of ["listings", "notifications", "challenges", "events", "audit_logs", "settings"]) {
    await db.from(t).delete().not(t === "settings" ? "key" : "id", "is", null);
  }
  await db.from("health_reports").delete().not("id", "is", null);
  await db.from("tasks").delete().not("id", "is", null);
  await db.from("schools").delete().not("id", "is", null);
  console.log("Demo data wiped.");
}

async function main() {
  if (process.argv.includes("--reset")) await reset();
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return console.log("Seed skipped: data exists (use --reset).");

  const [sunrise, valley] = await ins("schools", [{ name: "Sunrise High School", city: "Dubai" }, { name: "Green Valley Academy", city: "Sharjah" }]);
  const sara = await user({ email: "sara@eco.demo", name: "Sara Ahmed", role: "PARENT", avatar: "👩" });
  const ayaan = await user({ email: "ayaan@eco.demo", name: "Ayaan Sharma", role: "STUDENT", memberId: "STU-100001", grade: "Class 10", schoolId: sunrise.id, avatar: "🧑‍🎓" });
  const zara = await user({ email: "zara@eco.demo", name: "Zara Ahmed", role: "STUDENT", grade: "Grade 7", schoolId: sunrise.id, parentId: sara.id, avatar: "👩‍🎓" });
  const rohan = await user({ email: "rohan@eco.demo", name: "Rohan Mehta", role: "EMPLOYEE", memberId: "EMP-100003", department: "Facilities", avatar: "🧑‍💼" });
  const priya = await user({ email: "priya@eco.demo", name: "Ms. Priya Nair", role: "SCHOOL_ADMIN", schoolId: sunrise.id, avatar: "🏫" });
  const community = await user({ email: "community@eco.demo", name: "Dubai Green Community", role: "COMMUNITY", community: "Dubai Green Community", avatar: "🌍" });
  await user({ email: "admin@eco.demo", name: "Admin Master", role: "SUPER_ADMIN", avatar: "👑", password: process.env.SEED_ADMIN_PASSWORD || DEMO_PASSWORD });
  const teacher = await user({ email: "daniel@eco.demo", name: "Daniel Brooks", role: "TEACHER", memberId: "STF-100008", grade: "Class 10", schoolId: sunrise.id, avatar: "🧑‍🏫" });
  const nurse = await user({ email: "nurse@eco.demo", name: "Nurse Fatima Ali", role: "HEALTH_MONITOR", grade: "Class 10", schoolId: sunrise.id, avatar: "🩺" });
  const anita = await user({ email: "anita@eco.demo", name: "Anita Rao", role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" });
  const karim = await user({ email: "karim@eco.demo", name: "Karim Haddad", role: "EMPLOYEE", department: "Facilities", avatar: "🧑‍💼" });

  const names = ["Aisha", "Omar", "Leo", "Mira", "Kabir", "Noor", "Ethan", "Fatima", "Arjun", "Lina", "Yusuf", "Maya", "Dev", "Hana", "Sami", "Riya"];
  const extras: Row[] = [];
  for (const [i, n] of names.entries()) {
    extras.push(await user({
      email: `${n.toLowerCase()}${DEMO_DOMAIN}`, name: `${n} ${pick(["K.", "R.", "S.", "M.", "A."])}`, role: "STUDENT",
      grade: i % 3 === 1 ? "Class 10" : `Grade ${6 + (i % 6)}`, schoolId: i % 3 ? sunrise.id : valley.id, avatar: pick(["🦊", "🐢", "🌻", "🌱"]),
    }));
  }

  const points = new Map<string, number>();
  for (const u of [ayaan, zara, rohan, community, anita, karim, ...extras]) {
    const n = u.email === "ayaan@eco.demo" ? 60 : 8 + Math.floor(rand() * 30);
    const scans = Array.from({ length: n }, () => {
      const [label, wasteType] = pick(ITEMS);
      const g = GUIDE[wasteType];
      return { userId: u.id, label, wasteType, confidence: 0.6 + rand() * 0.39, weightKg: Math.round(g.defaultKg * (0.5 + rand() * 4) * 100) / 100 + 0.1, points: g.points, createdAt: new Date(Date.now() - rand() * 30 * DAY).toISOString() };
    });
    await ins("scans", scans);
    points.set(u.id, scans.reduce((s, x) => s + x.points, 0));
  }

  const listings = await ins("listings", [
    { title: "Reusable Water Bottle", description: "Steel, 750ml. Ditch single-use plastic.", category: "Reuse", emoji: "🧴", pricePoints: 200, stock: 25 },
    { title: "Eco Tote Bag", description: "Organic cotton shopping bag.", category: "Reuse", emoji: "👜", pricePoints: 150, stock: 39 },
    { title: "Plant Pot", description: "Upcycled pot with a seedling.", category: "Reuse", emoji: "🪴", pricePoints: 250, stock: 15 },
    { title: "Used Books Bundle", description: "Donated textbooks, gently used.", category: "Donate", emoji: "📚", pricePoints: 100, stock: 20 },
    { title: "School Uniform (donated)", description: "Clean, pre-loved uniform sets.", category: "Donate", emoji: "👕", pricePoints: 80, stock: 12 },
    { title: "Compost Starter Kit", description: "Turn food scraps into soil.", category: "Others", emoji: "🪱", pricePoints: 300, stock: 10 },
    { title: "Bamboo Cutlery Set", description: "Carry-anywhere cutlery.", category: "Reuse", emoji: "🥢", pricePoints: 120, stock: 30 },
    { title: "Plant a Tree", description: "We plant a tree on your behalf.", category: "Others", emoji: "🌳", pricePoints: 500, stock: 100 },
  ]);
  const tote = listings.find((l) => l.title === "Eco Tote Bag")!;

  const [foodChallenge, plasticChallenge] = await ins("challenges", [
    { title: "Reduce Food Waste", description: "Scan and compost 2 kg of food scraps instead of binning them.", wasteType: "ORGANIC", targetKg: 2, rewardPoints: 100, endsAt: inDays(14) },
    { title: "Plastic-Free Week", description: "Recycle 1 kg of plastic and switch to a reusable bottle.", wasteType: "PLASTIC", targetKg: 1, rewardPoints: 80, endsAt: inDays(7) },
    { title: "E-waste Drive", description: "Bring old gadgets to the school e-waste box.", wasteType: "EWASTE", targetKg: 1, rewardPoints: 150, endsAt: inDays(21) },
  ]);
  await ins("challenge_joins", [
    { userId: ayaan.id, challengeId: foodChallenge.id, completed: true, completedAt: ago(1), joinedAt: ago(10) },
    { userId: ayaan.id, challengeId: plasticChallenge.id },
  ]);
  // A past purchase, like the mockup's "Purchased: Eco Tote Bag"; Ayaan's points reflect challenge + purchase.
  await ins("purchases", { userId: ayaan.id, listingId: tote.id, points: tote.pricePoints, createdAt: ago(2) });
  points.set(ayaan.id, points.get(ayaan.id)! + foodChallenge.rewardPoints - tote.pricePoints);
  for (const [id, p] of points) await db.from("profiles").update({ points: p }).eq("id", id);

  const classes = Array.from(new Set(extras.map((e) => e.grade as string).concat("Class 10", "Grade 7")));
  await ins("health_reports", [
    ...classes.flatMap((c) => [3, 2, 1].map((d) => ({ schoolId: sunrise.id, className: c, reporterId: nurse.id, airQuality: "GOOD", temperatureC: 23 + Math.round(rand() * 4), hygiene: 4, cleaning: "CLEAN", wasteLevel: pick(["LOW", "MEDIUM"]), present: 27 + Math.floor(rand() * 3), total: 30, createdAt: ago(d) }))),
    { schoolId: sunrise.id, className: "Class 10", reporterId: nurse.id, airQuality: "MODERATE", temperatureC: 31, hygiene: 3, cleaning: "NEEDS_CLEANING", wasteLevel: "FULL", present: 26, total: 30, incident: "", createdAt: ago(0.1) },
    { schoolId: sunrise.id, className: "Grade 7", reporterId: nurse.id, airQuality: "GOOD", temperatureC: 24, hygiene: 4, cleaning: "CLEAN", wasteLevel: "MEDIUM", present: 29, total: 30, incident: "Minor spill in the lab, cleaned up", createdAt: ago(0.2) },
  ]);

  const [task1] = await ins("tasks", { title: "Bring 3 clean plastic bottles", description: "We're building a bottle greenhouse for the school garden.", className: "Class 10", schoolId: sunrise.id, points: 20, dueAt: inDays(3), creatorId: teacher.id });
  await ins("task_dones", extras.filter((e) => e.grade === "Class 10").slice(0, 3).map((s, i) => ({ taskId: task1.id, userId: s.id, approved: i === 0 })));

  const at = (d: number, h: number) => { const x = new Date(Date.now() + d * DAY); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const events = await ins("events", [
    { kind: "EVENT", title: "Green Expo 2026", description: "Swap, repair and upcycle stalls plus a recycling quiz.", location: "Community Hall", startsAt: at(2, 10), organizerId: community.id },
    { kind: "WORKSHOP", title: "Upcycling Workshop: Bottle Planters", description: "Turn plastic bottles into self-watering planters.", location: "Sunrise High · Art Room", startsAt: at(4, 14), schoolId: sunrise.id, organizerId: teacher.id },
    { kind: "CAMPAIGN", title: "Zero Plastic Lunch Week", description: "Bring lunch in reusable boxes all week.", location: "Sunrise High", startsAt: at(6, 8), schoolId: sunrise.id, organizerId: priya.id },
    { kind: "PROGRAM", title: "Monthly E-waste Collection Drive", description: "Drop old phones, chargers and batteries for safe recycling.", location: "City Recycling Centre", startsAt: at(9, 9), organizerId: community.id },
    { kind: "WORKSHOP", title: "Home Composting 101", description: "Learn to turn food scraps into rich soil.", location: "Community Garden", startsAt: at(12, 17), organizerId: community.id },
  ]);
  await ins("event_rsvps", [ayaan, zara, ...extras.slice(0, 6)].map((u) => ({ eventId: events[0].id, userId: u.id })).concat({ eventId: events[1].id, userId: ayaan.id }));

  await ins("listings", [
    { kind: "DONATE", title: "Grade 9 Science Textbook", description: "Good condition, a few highlights.", category: "Donate", emoji: "📚", pricePoints: 0, stock: 1, ownerId: extras[0].id },
    { kind: "SELL", title: "Kids Bicycle", description: "Outgrown, works perfectly. Pick up at school gate.", category: "Reuse", emoji: "🚲", pricePoints: 120, stock: 1, ownerId: community.id },
    { kind: "EXCHANGE", title: "Board Games Bundle", description: "Swap for any puzzles or books.", category: "Others", emoji: "🧸", pricePoints: 0, stock: 1, ownerId: extras[2].id },
  ]);

  await ins("notifications", [
    { kind: "PICKUP", title: "Waste collection tomorrow at 9 AM", body: "Put sorted bins out by 8:30 AM.", createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
    { kind: "CHALLENGE", title: "New challenge: Reduce Food Waste", body: "Compost 2 kg of food scraps to earn 100 points.", createdAt: ago(1) },
    { kind: "ANNOUNCEMENT", title: "School achieved 85% recycling rate!", body: "Amazing work, Sunrise High School.", createdAt: ago(1) },
    { kind: "EVENT", title: "Community event: Green Expo 2026", body: "Swap, repair and upcycle stalls this Saturday.", createdAt: ago(2) },
    { userId: sara.id, kind: "HEALTH", title: "Health & safety alert · Grade 7", body: "Incident: Minor spill in the lab, cleaned up", createdAt: ago(0.2) },
    { userId: sara.id, kind: "ANNOUNCEMENT", title: "Parent-teacher eco meeting", body: "Thursday 4 PM, school library. All parents welcome.", createdAt: ago(1) },
    { userId: ayaan.id, kind: "TASK", title: "New task: Bring 3 clean plastic bottles", body: "Due in 3 days · +20 pts", createdAt: ago(0.5) },
  ]);

  // Backdate badges the demo users already qualify for, so history shows realistic dates.
  const { data: everyone } = await db.from("profiles").select("id, points, scans(wasteType), purchases(id), challenge_joins(completed)");
  for (const u of everyone ?? []) {
    const badges = earnedBadges({
      scans: u.scans.length, points: u.points, types: new Set(u.scans.map((s: Row) => s.wasteType)).size,
      purchases: u.purchases.length, challenges: u.challenge_joins.filter((j: Row) => j.completed).length,
    });
    if (badges.length) await ins("user_badges", badges.map((b, i) => ({ userId: u.id, badgeId: b.id, earnedAt: ago(25 - i * 3 - rand() * 2) })));
  }
  console.log(`Seeded. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
