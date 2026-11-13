import { describe, expect, it } from "vitest";
import { scanSchema, signupSchema } from "@/lib/validation";
import { earnedBadges, goalPercent } from "@/lib/rewards";

const base = { name: "Test User", email: "T@X.com", password: "longenough" };

describe("signupSchema", () => {
  it("normalises email", () => {
    const r = signupSchema.parse({ ...base, role: "EMPLOYEE" });
    expect(r.email).toBe("t@x.com");
  });
  it("rejects SUPER_ADMIN self-signup", () => {
    expect(signupSchema.safeParse({ ...base, role: "SUPER_ADMIN" }).success).toBe(false);
  });
  it("requires a school for students", () => {
    expect(signupSchema.safeParse({ ...base, role: "STUDENT" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, role: "STUDENT", schoolId: "abc" }).success).toBe(true);
  });
  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ ...base, role: "PARENT", password: "short" }).success).toBe(false);
  });
});

describe("scanSchema", () => {
  it("rejects bad weights and unknown types", () => {
    expect(scanSchema.safeParse({ label: "x", wasteType: "PLASTIC", confidence: 0.5, weightKg: 0 }).success).toBe(false);
    expect(scanSchema.safeParse({ label: "x", wasteType: "URANIUM", confidence: 0.5, weightKg: 1 }).success).toBe(false);
    expect(scanSchema.safeParse({ label: "x", wasteType: "GLASS", confidence: 0.5, weightKg: 1 }).success).toBe(true);
  });
});

describe("rewards", () => {
  it("awards badges by thresholds", () => {
    const ids = earnedBadges({ scans: 10, points: 120, types: 2, purchases: 0, challenges: 0 }).map((b) => b.id);
    expect(ids).toEqual(["first", "ten", "hundred"]);
  });
  it("caps goal at 100%", () => {
    expect(goalPercent(40)).toBe(100);
    expect(goalPercent(10)).toBe(50);
  });
});
