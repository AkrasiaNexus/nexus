// Row types mirroring supabase/migrations (camelCase columns, ISO timestamps as strings on the wire).
export type Role = "STUDENT" | "PARENT" | "EMPLOYEE" | "SCHOOL_ADMIN" | "COMMUNITY" | "SUPER_ADMIN" | "TEACHER" | "HEALTH_MONITOR" | "COMMUNITY_ADMIN";
export type WasteType = "PLASTIC" | "PAPER" | "GLASS" | "METAL" | "ORGANIC" | "EWASTE" | "TEXTILE" | "OTHER";
export type NoticeKind = "ANNOUNCEMENT" | "CHALLENGE" | "PICKUP" | "EVENT" | "TASK" | "HEALTH" | "MARKETPLACE" | "REWARD";

export type Profile = {
  id: string; memberId: string; email: string; name: string; role: Role; points: number; avatar: string;
  grade: string | null; department: string | null; community: string | null; active: boolean;
  createdAt: string; schoolId: string | null; parentId: string | null; pendingParentId: string | null; communityId: string | null;
  equippedBackground: string | null; equippedBorder: string | null; equippedSticker: string | null; mutedKinds: string[];
};
export type HealthReport = {
  id: string; schoolId: string; className: string; reporterId: string; airQuality: string; temperatureC: number;
  hygiene: number; cleaning: string; wasteLevel: string; present: number; total: number; incident: string; createdAt: string;
};
