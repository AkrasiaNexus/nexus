# EcoSphere AI

AI-powered web app for waste sorting, recycling guidance and circular-economy rewards in schools, homes and communities. Aligned with **SDG 12, Responsible Consumption & Production** (targets 12.4 e-waste, 12.5 reduce/reuse/recycle, 12.8 awareness).

## Feature map coverage (from the brief)

| Brief item | Where |
|---|---|
| AI classification (upload/scan → waste type + disposal guidance) | `/scan`: MobileNet **in the browser**, photos never uploaded, user confirms/corrects (human-in-the-loop), low-confidence flag |
| Smart recycling guide (where & how to recycle, reuse, compost) | `/guide`: steps, avoid list, reuse/repurpose ideas, "drop it off nearby", `/partners` |
| Circular economy marketplace (buy/sell/donate/exchange) | `/marketplace`: reward items + peer listings (sell for points, donate, swap), owner notified on claim |
| Green points & rewards | points per scan/task, badges, challenges (server-verified), avatar customisation |
| School waste monitoring (class-wise waste, cleaning status) | `/school`, `/teacher`: class-wise kg & recycling %, cleaning / bins / attendance per class |
| Health & safety monitoring | `/health`: daily classroom report (air, temp, hygiene, cleaning, bins, attendance, incidents) → automatic alerts to class, parents, admin |
| Reports & analytics | `/stats`: week/month/year, 7-day trend, **heat map**, by-type breakdown, leaderboards (students / classes / schools), AI month-end projection; CSV export |
| Reminders & notifications | `/notifications` (announcements, challenges, tasks, health, pickups, events) + home "Reminders" + personalised eco-tip |
| Community engagement | `/events`: events, DIY/upcycling workshops, campaigns, local recycling programs with RSVP |
| Partnerships (recyclers, NGOs, businesses) | `/partners` |
| Environmental & social impact + SDG 12 indicator | `/impact`: waste reduced, recycling rate, CO₂, water, trees, items reused, participation, SDG 12.4/12.5/12.8 progress |
| Security & privacy, responsible AI | `/privacy`: principles, **download my data**, **delete my account**; RBAC, audit logs, admin 2nd factor (Admin Code), Remember Me, Forgot Password → admin reset |
| Settings (every profile) | `/settings`: name, avatar, member ID, change password, privacy, log out |
| Admin tools | School Admin: Manage Classes, Manage Staff (enable/disable, reset password); Super Admin: Manage Users, System Settings (monitoring + pause sign-ups), Audit Logs, export |

UI follows the supplied mockup screen-for-screen: splash, role select, login, Home (leaf goal + timeline + period), Statistics, Marketplace, AI Waste Scanner, Recycling Guide, Green Points & Rewards, every role profile, Notifications and Activity History.

### Roles (login with email **or** member ID, e.g. `STU-100001`)

| Role | Dashboard |
|---|---|
| Student | personal impact (switch Me / My Class / School), tasks, classroom health, challenges, leaderboard |
| Parent | Child Progress (weekly summary, health & safety alerts, messages from school), recycling activity, child's reports |
| Teacher / Staff | class waste data, student performance & participation, assign tasks + approve, create events, class health, CSV |
| Health Monitor | daily classroom health/safety/attendance report, incidents, alerts history |
| Employee | personal impact, **My Department** totals & ranking |
| School Admin | whole school, class comparison, cleaning/health per class, broadcast (incl. parents), CSV export |
| Community Member | personal impact, events & campaigns, nearby centres, marketplace, public impact data |
| Super Admin | platform analytics, manage users (enable/disable), audit logs, broadcast, export data |

## Security
- **Supabase Auth** (email or member-ID login, real reset-password emails, sessions via `@supabase/ssr`), Remember me, lockout after 5 failed logins / 15 min, Admin Code for admin roles.
- **Row-level security on every table** (`supabase/migrations`): students see their own data, parents only children who **approved** the link, teachers/health monitors their class, school admins their school, super admins everything. Other people appear only through the `public_profiles` view (names; stats only within your school).
- **Points and stock only change inside database functions** (`log_scan`, `redeem`, `claim_challenge`, `approve_task`): atomic and rate-limited.
- Staff and school-admin signups start **disabled until approved**; disabling a user also bans their Supabase login.
- zod validation on every input, audit log, CSV formula-injection guard. `supabase/tests/rls.sql` impersonates each role and must report all PASS.

## Stack
Next.js 14 (App Router, server actions) · Tailwind · Supabase (Postgres, Auth, RLS) · TensorFlow.js · Vitest

## Supabase setup (once per project)
1. **SQL Editor** → run `supabase/migrations/0001_init.sql`, then `0002_security_review.sql`.
2. Optional check: run `supabase/tests/rls.sql`; every row must say PASS.
3. **Authentication → URL Configuration**: Site URL = your app URL (`http://localhost:3000` locally, your Vercel URL live); add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to Redirect URLs.
4. **Authentication → Providers → Email**: turn on **Secure password change**.

## Run locally
Create `.env`:
```
NEXT_PUBLIC_SUPABASE_URL="https://<project-id>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_…"
SUPABASE_SECRET_KEY="sb_secret_…"          # server only, never commit
SITE_URL="http://localhost:3000"
ADMIN_SIGNUP_CODE="…"   STAFF_SIGNUP_CODE="…"   ADMIN_LOGIN_CODE="…"
```
```bash
npm install
npm run seed      # demo data (skips if users exist); SEED_ALLOW_RESET=1 npm run seed -- --reset to start over
npm run dev
```
Demo accounts (password `eco12345`, all `@eco.demo`; admins also enter the Admin Code): `ayaan@` student (or ID `STU-100001`), `sara@` parent, `rohan@` employee, `daniel@` teacher, `nurse@` health monitor, `priya@` school admin, `community@`, `admin@` super admin.

## Deploy (Vercel)
1. Vercel → import the repo, **Root Directory = `ecosphere`**.
2. Env vars: the `.env` values above with `SITE_URL=https://<your-app>.vercel.app` (and `SEED_ADMIN_PASSWORD` if you seed from your machine).
3. Deploy, then add the Vercel URL to Supabase Redirect URLs (step 3 above).

## Tests
`npm test`: unit tests (classifier mapping, impact, health alerts, SDG, heat map, CSV, validation, badges). `supabase/tests/rls.sql`: row-level-security self-test against the live project.
