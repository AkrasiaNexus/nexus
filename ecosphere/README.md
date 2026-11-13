# EcoSphere AI

AI-powered web app for waste sorting, recycling guidance and circular-economy rewards in schools, homes and communities. Aligned with **SDG 12, Responsible Consumption & Production** (targets 12.3 food waste, 12.5 reduce/reuse/recycle, 12.8 awareness).

## What it does
- **AI Waste Scanner**: MobileNet v2 runs **in the browser**, so photos never leave the device. It maps the detected item to a waste stream (plastic, paper, glass, metal, organic/food, e-waste, textile, general) and shows bin + disposal steps. The user can always correct the category before logging (human-in-the-loop). Weights are self-hosted in `public/models`.
- **Recycling Guide**: per-material steps, things to avoid, reuse/repurpose ideas, facts.
- **Impact stats**: kg diverted, CO₂ avoided, water saved, tree-equivalents, recycling rate, 7-day trend, breakdown by type, leaderboard, month-end projection.
- **Green Points, Badges & Challenges**: points per scan; challenges verified server-side from logged scans.
- **Circular Marketplace**: redeem points for reusable, donated and upcycled items (stock and points are protected against double-spend).
- **Notifications**: pickups, challenges, events; admins can broadcast.
- **6 roles**, each with its own dashboard scope:

| Role | Sees |
|---|---|
| Student / Employee / Community | own impact; community gets nearby recycling centres |
| Parent | linked children's progress |
| School Admin | whole school, class-wise comparison, broadcast |
| Super Admin | whole platform, manage users, audit logs, broadcast |

## Security
bcrypt passwords, signed httpOnly JWT cookie, route middleware + per-page role guards, zod validation on every input, login lockout (5 fails / 15 min), scan rate limit (60/hour), audit log, Super Admin cannot be self-registered, School Admin signup needs `ADMIN_SIGNUP_CODE`.

## Stack
Next.js 14 (App Router, server actions) · Tailwind · Prisma · PostgreSQL (Supabase) · TensorFlow.js · Vitest

## Run locally
```bash
cp .env.example .env   # point DATABASE_URL/DIRECT_URL at any Postgres
npm install
npx prisma migrate deploy && npm run seed
npm run dev
```
Demo accounts (password `eco12345`): `ayaan@` student, `sara@` parent, `rohan@` employee, `priya@` school admin, `community@`, `admin@` super admin (all `@eco.demo`).

## Deploy (Supabase + Vercel)
1. Supabase → new project → **Connect** → copy the *Transaction pooler* URL (port 6543, add `?pgbouncer=true`) and the *Session pooler* URL (port 5432).
2. Vercel → import the repo, **Root Directory = `ecosphere`**.
3. Env vars: `DATABASE_URL` (6543), `DIRECT_URL` (5432), `SESSION_SECRET` (`openssl rand -base64 32`), `ADMIN_SIGNUP_CODE`, optionally `SEED_ADMIN_PASSWORD` (overrides the demo super-admin password).
4. Deploy. `vercel-build` runs migrations and seeds demo data once (skipped if users already exist).

## Tests
`npm test` runs unit tests for the classifier mapping, impact maths, validation and badges.
