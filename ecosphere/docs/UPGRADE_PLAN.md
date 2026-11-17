# EcoSphere AI — platform upgrade plan

Source brief: "ECOSPHERE AI — COMPLETE WEBSITE UPGRADE & IMPLEMENTATION PROMPT" (19 parts).
Decisions (user, 2026-11-17): mockup look refined toward Opal · food waste = guide category only (no tracking) ·
keep all 8 roles + add COMMUNITY_ADMIN · run phases autonomously.

## Baseline (Phase 1 inspection)
Next.js 14 App Router + Tailwind · Supabase (Postgres, Auth via @supabase/ssr, RLS, RPCs) · TF.js MobileNet on-device ·
16 tables (`supabase/migrations`) · 33 pages · roles: STUDENT, PARENT, EMPLOYEE, TEACHER, HEALTH_MONITOR, SCHOOL_ADMIN,
COMMUNITY, SUPER_ADMIN · RLS self-test `supabase/tests/rls.sql` (must be all PASS).

Rules: never delete working features or nav sections; non-destructive migrations only (0003+); every write
authorised server-side or inside an RLS/RPC; no placeholder buttons; demo data labelled as demo.

## Phases
2. **UI** — Opal refinement (charcoal surfaces, calmer lime, less glow, more whitespace); responsive AppShell:
   desktop/tablet sidebar grouped (Main · You · School/Community · Admin Management), mobile dock kept.
3. **Auth & roles** — COMMUNITY_ADMIN role; `communities` table + profiles.communityId; community choice at signup;
   community admins need code + super-admin approval.
4. **Profiles** — role-specific sections per brief incl. Community Admin dashboard; teacher class announcements +
   create class challenges; community member campaigns/donations/challenges.
5. **Dashboard & stats** — dashboard: recent activity, upcoming challenges, announcements, quick actions
   (Scan, Statistics, Guide, Green Points, Marketplace, Challenges → `/challenges`); stats: period comparison,
   tap-to-drill-down by waste type, role-scoped analytics, admin filters (school/community/class/role/date).
6. **Features** — points ledger (`point_events`) written only by RPCs; reward rules (`reward_rules`) + cosmetics
   catalogue (`reward_items`, `user_unlocks`: stickers, backgrounds, borders, tokens) redeemed by RPC;
   marketplace: photos (Supabase Storage), condition, approval status, reports, My Listings / My Transactions;
   notifications: read/unread (`notification_reads`), mark-all-read, preferences (muted kinds);
   history: date + category filters incl. listings/donations/unlocks; guide: Food category, examples, search;
   scanner: server classifier integration layer (`/api/classify`, env-configured, honest "not configured" state).
7. **Admin** — users (search, role/school/community/status filters, detail/edit, assign role, suspend/reactivate),
   schools, communities (+ assign admins), challenges, rewards (rules, catalogue, point adjustments), marketplace
   moderation + reports queue, system settings grouped, audit search/filters, audit log append-only (trigger).
8. **Integration testing** — RLS self-test extended per new table; E2E per role (blocked in sandbox until the
   "Supabase secret key" network secret is removed — see README); build/lint/unit.
9. **Polish** — every nav item/button/form, empty/loading/error states, responsive pass, console errors.

## Known external needs
- Sandbox only: delete the "Supabase secret key (EcoSphere)" network secret so signed-in requests keep the user JWT.
- Supabase dashboard: Auth URL config (Site URL + Redirect URLs) and "Secure password change" (user to set).
- Optional server AI: `CLASSIFIER_URL` (+ `CLASSIFIER_API_KEY`) for a hosted model; on-device MobileNet works without it.

## Status (2026-11-17)
Phases 2–7 shipped. Phase 8: RLS self-test 32/32 PASS (adds moderation, reports, notification reads, storage);
unit tests, lint, build green; security reviews done (Phase 6 + admin) with fixes in 0009 and app code.
Signed-in E2E per role still blocked in the sandbox by the injected network secret (see Known external needs).
Phase 9: impeccable detector 0 findings.
