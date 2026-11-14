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
    expect(signupSchema.safeParse({ ...base, role: "STUDENT", schoolId: "abc" }).success).toBe(false); // class missing
    expect(signupSchema.safeParse({ ...base, role: "STUDENT", schoolId: "abc", grade: "Class 10" }).success).toBe(true);
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

import { healthAlerts, healthStatus } from "@/lib/health";
import { sdgIndicators } from "@/lib/sdg";
import { toCsv } from "@/lib/csv";
import { listingSchema, loginSchema, memberIdFor, healthSchema } from "@/lib/validation";

const okHealth = { airQuality: "GOOD", temperatureC: 24, hygiene: 4, cleaning: "CLEAN", wasteLevel: "LOW", present: 28, total: 30, incident: "" };

describe("health alerts", () => {
  it("is clear for a normal classroom", () => {
    expect(healthAlerts(okHealth)).toEqual([]);
    expect(healthStatus([])).toBe("OK");
  });
  it("flags every threshold", () => {
    const a = healthAlerts({ airQuality: "POOR", temperatureC: 33, hygiene: 1, cleaning: "NEEDS_CLEANING", wasteLevel: "FULL", present: 10, total: 30, incident: "fall" });
    expect(a).toHaveLength(7);
    expect(healthStatus(a)).toBe("ACTION");
  });
  it("rejects present > total", () => {
    expect(healthSchema.safeParse({ ...okHealth, className: "C1", present: 31 }).success).toBe(false);
  });
});

describe("sdg", () => {
  it("caps progress at 100 and averages", () => {
    const r = sdgIndicators({ recyclingRate: 100, activeUsers: 10, totalUsers: 10, reuseTrades: 999, ewasteKg: 999, eventsHeld: 99 });
    expect(r.overall).toBe(100);
  });
});

describe("csv", () => {
  it("quotes and neutralises formulas", () => {
    expect(toCsv([{ a: '=HYPERLINK("x")', b: 'say "hi"' }])).toBe('"a","b"\n"\'=HYPERLINK(""x"")","say ""hi"""');
  });
});

describe("ids & login", () => {
  it("prefixes member IDs by role", () => {
    expect(memberIdFor("TEACHER")).toMatch(/^STF-\d{6}$/);
  });
  it("normalises ID and email logins", () => {
    expect(loginSchema.parse({ email: "stu-100001", password: "x" }).email).toBe("STU-100001");
    expect(loginSchema.parse({ email: "A@B.com", password: "x" }).email).toBe("a@b.com");
  });
  it("defaults donation price to 0", () => {
    expect(listingSchema.parse({ kind: "DONATE", title: "t", description: "d", category: "Donate", emoji: "📚" }).pricePoints).toBe(0);
  });
});
