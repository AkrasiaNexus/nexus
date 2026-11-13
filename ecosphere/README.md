# EcoSphere AI

AI-powered web app for waste sorting, recycling guidance and circular-economy rewards in schools, homes and communities. Aligned with **SDG 12, Responsible Consumption & Production** (targets 12.3 food waste, 12.5 reduce/reuse/recycle, 12.8 awareness).

## Feature map coverage (from the brief)

| Brief item | Where |
|---|---|
| AI classification (upload/scan → waste type + disposal guidance) | `/scan`: MobileNet **in the browser**, photos never uploaded, user confirms/corrects (human-in-the-loop), low-confidence flag |
| Smart recycling guide (where & how to recycle, reuse, compost) | `/guide`: steps, avoid list, reuse/repurpose ideas, "drop it off nearby", `/partners` |
| Food waste management (track, recipes, reduce) | `/food`: log item/kg/reason/disposal, rescue recipes for your most-wasted category, 7-day graph, reasons chart, tips |
| Circular economy marketplace (buy/sell/donate/exchange) | `/marketplace`: reward items + peer listings (sell for points, donate, swap), owner notified on claim |
| Green points & rewards | points per scan/food diversion/task, badges, challenges (server-verified), avatar customisation |
| School waste monitoring (class-wise waste, cleaning status) | `/school`, `/teacher`: class-wise kg & recycling %, cleaning / bins / attendance per class |
| Health & safety monitoring | `/health`: daily classroom report (air, temp, hygiene, cleaning, bins, attendance, incidents) → automatic alerts to class, parents, admin |
| Reports & analytics | `/stats`: week/month/year, 7-day trend, **heat map**, by-type breakdown, leaderboards (students / classes / schools), AI month-end projection; CSV export |
| Reminders & notifications | `/notifications` (announcements, challenges, tasks, health, pickups, events) + home "Reminders" + personalised eco-tip |
| Community engagement | `/events`: events, DIY/upcycling workshops, campaigns, local recycling programs with RSVP |
| Partnerships (recyclers, NGOs, businesses) | `/partners` |
| Environmental & social impact + SDG 12 indicator | `/impact`: waste reduced, recycling rate, CO₂, water, trees, food waste diverted, participation, SDG 12.3/12.4/12.5/12.8 progress |
| Security & privacy, responsible AI | `/privacy`: principles, **download my data**, **delete my account**; RBAC, audit logs |

### Roles (login with email **or** member ID, e.g. `STU-100001`)

| Role | Dashboard |
|---|---|
| Student | personal impact (switch Me / My Class / School), tasks, classroom health, challenges, leaderboard |
| Parent | weekly summary, child progress, health & safety alerts, messages from school, child's reports |
| Teacher / Staff | class waste data, student performance & participation, assign tasks + approve, create events, class health, CSV |
| Health Monitor | daily classroom health/safety/attendance report, incidents, alerts history |
| Employee | personal impact, **My Department** totals & ranking |
| School Admin | whole school, class comparison, cleaning/health per class, broadcast (incl. parents), CSV export |
| Community Member | personal impact, events & campaigns, nearby centres, marketplace, public impact data |
| Super Admin | platform analytics, manage users (enable/disable), audit logs, broadcast, export data |

## Security
bcrypt passwords, signed httpOnly JWT cookie, route middleware + per-page role guards, zod validation on every input, login lockout (5 fails / 15 min), scan rate limit (60/hour), audit log, Super Admin cannot be self-registered, School Admin signup needs `ADMIN_SIGNUP_CODE`, Teacher/Health Monitor signup needs `STAFF_SIGNUP_CODE`, CSV exports neutralise formula injection, peer-marketplace points/stock use conditional updates (no double-spend).

## Stack
Next.js 14 (App Router, server actions) · Tailwind · Prisma · PostgreSQL (Supabase) · TensorFlow.js · Vitest

## Run locally
```bash
cp .env.example .env   # point DATABASE_URL/DIRECT_URL at any Postgres
npm install
npx prisma migrate deploy && npm run seed
npm run dev
```
Demo accounts (password `eco12345`, all `@eco.demo`): `ayaan@` student (or ID `STU-100001`), `sara@` parent, `rohan@` employee, `daniel@` teacher, `nurse@` health monitor, `priya@` school admin, `community@`, `admin@` super admin.

## Deploy (Supabase + Vercel)
1. Supabase → new project → **Connect** → copy the *Transaction pooler* URL (port 6543, add `?pgbouncer=true`) and the *Session pooler* URL (port 5432).
2. Vercel → import the repo, **Root Directory = `ecosphere`**.
3. Env vars: `DATABASE_URL` (6543), `DIRECT_URL` (5432), `SESSION_SECRET` (`openssl rand -base64 32`), `ADMIN_SIGNUP_CODE`, `STAFF_SIGNUP_CODE`, optionally `SEED_ADMIN_PASSWORD` (overrides the demo super-admin password).
4. Deploy. `vercel-build` runs migrations and seeds demo data once (skipped if users already exist).

## Tests
`npm test`: 33 unit tests (classifier mapping, impact, food, health alerts, SDG, heat map, CSV, validation, badges). A Playwright walkthrough covered every role × page plus task, health-alert, food, peer-marketplace, events, export, signup and delete-account flows.
