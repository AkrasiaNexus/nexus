import { randomInt } from "crypto";
import { z } from "zod";
import { WASTE_TYPES } from "./waste";

export const PUBLIC_ROLES = ["STUDENT", "PARENT", "EMPLOYEE", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN", "COMMUNITY"] as const;
export const SCHOOL_ROLES = ["STUDENT", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN"];
export const CLASS_ROLES = ["STUDENT", "TEACHER", "HEALTH_MONITOR"];

const ID_PREFIX: Record<string, string> = { STUDENT: "STU", PARENT: "PAR", EMPLOYEE: "EMP", TEACHER: "STF", HEALTH_MONITOR: "HLT", SCHOOL_ADMIN: "ADM", COMMUNITY: "COM", SUPER_ADMIN: "SUP" };
export const memberIdFor = (role: string) => `${ID_PREFIX[role]}-${randomInt(100000, 999999)}`;

const email = z.string().trim().toLowerCase().email().max(120);

// Log in with email or member ID (e.g. STU-123456).
export const loginSchema = z.object({ email: z.string().trim().min(3).max(120).transform((v) => (v.includes("@") ? v.toLowerCase() : v.toUpperCase())), password: z.string().min(1).max(200) });

export const signupSchema = z
  .object({
    role: z.enum(PUBLIC_ROLES),
    name: z.string().trim().min(2).max(60),
    email,
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    schoolId: z.string().max(40).optional(),
    grade: z.string().trim().max(20).optional(),
    department: z.string().trim().max(60).optional(),
    community: z.string().trim().max(60).optional(),
    childEmail: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal("")),
    adminCode: z.string().max(60).optional(),
  })
  .refine((d) => !SCHOOL_ROLES.includes(d.role) || !!d.schoolId, { message: "Please choose a school", path: ["schoolId"] })
  .refine((d) => !CLASS_ROLES.includes(d.role) || !!d.grade, { message: "Please enter your class", path: ["grade"] });

export const scanSchema = z.object({
  label: z.string().trim().min(1).max(80),
  wasteType: z.enum(WASTE_TYPES),
  confidence: z.coerce.number().min(0).max(1),
  weightKg: z.coerce.number().positive().max(50),
});

export const MAX_SCANS_PER_HOUR = 60;
export const MAX_LOGIN_FAILS = 5;

const text = (max: number) => z.string().trim().min(1).max(max);

export const foodSchema = z.object({
  item: text(60),
  category: z.enum(["FRUIT_VEG", "GRAINS", "BAKERY", "DAIRY", "MEAT", "COOKED", "OTHER"]),
  kg: z.coerce.number().positive().max(100),
  reason: z.enum(["LEFTOVER", "PLATE_WASTE", "EXPIRED", "SPOILED", "OVERCOOKED"]),
  disposal: z.enum(["COMPOST", "DONATE", "ANIMAL_FEED", "BIN"]),
});

export const listingSchema = z.object({
  kind: z.enum(["SELL", "DONATE", "EXCHANGE"]),
  title: text(60),
  description: text(200),
  category: z.enum(["Reuse", "Donate", "Others"]),
  emoji: z.enum(["📦", "📚", "👕", "🧸", "🪑", "🚲", "🔌", "🪴", "🎒", "🍳"]),
  pricePoints: z.coerce.number().int().min(0).max(1000).default(0),
});

export const taskSchema = z.object({
  title: text(80),
  description: text(280),
  points: z.coerce.number().int().min(0).max(200),
  dueAt: z.coerce.date(),
});

export const healthSchema = z.object({
  className: text(20),
  airQuality: z.enum(["GOOD", "MODERATE", "POOR"]),
  temperatureC: z.coerce.number().min(-10).max(60),
  hygiene: z.coerce.number().int().min(1).max(5),
  cleaning: z.enum(["CLEAN", "IN_PROGRESS", "NEEDS_CLEANING"]),
  wasteLevel: z.enum(["LOW", "MEDIUM", "FULL"]),
  present: z.coerce.number().int().min(0).max(500),
  total: z.coerce.number().int().min(1).max(500),
  incident: z.string().trim().max(280).default(""),
}).refine((d) => d.present <= d.total, { message: "Present can't exceed total", path: ["present"] });

export const eventSchema = z.object({
  kind: z.enum(["EVENT", "WORKSHOP", "CAMPAIGN", "PROGRAM"]),
  title: text(80),
  description: text(280),
  location: text(80),
  startsAt: z.coerce.date(),
});
