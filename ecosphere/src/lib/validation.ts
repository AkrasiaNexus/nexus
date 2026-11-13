import { z } from "zod";
import { WASTE_TYPES } from "./waste";

export const PUBLIC_ROLES = ["STUDENT", "PARENT", "EMPLOYEE", "SCHOOL_ADMIN", "COMMUNITY"] as const;

const email = z.string().trim().toLowerCase().email().max(120);

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });

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
  .refine((d) => !["STUDENT", "SCHOOL_ADMIN"].includes(d.role) || !!d.schoolId, {
    message: "Please choose a school", path: ["schoolId"],
  });

export const scanSchema = z.object({
  label: z.string().trim().min(1).max(80),
  wasteType: z.enum(WASTE_TYPES),
  confidence: z.coerce.number().min(0).max(1),
  weightKg: z.coerce.number().positive().max(50),
});

export const MAX_SCANS_PER_HOUR = 60;
export const MAX_LOGIN_FAILS = 5;
