import type { NoticeKind } from "./types";

// Every kind a user may mute. HEALTH (classroom safety alerts) is deliberately not mutable.
export const MUTABLE_KINDS: Record<Exclude<NoticeKind, "HEALTH">, string> = {
  ANNOUNCEMENT: "Announcements", CHALLENGE: "Challenges", TASK: "Tasks", EVENT: "Events",
  PICKUP: "Pickups", MARKETPLACE: "Marketplace", REWARD: "Rewards & points",
};
export const isMutable = (k: string): k is keyof typeof MUTABLE_KINDS => Object.hasOwn(MUTABLE_KINDS, k);
