# Team Qatar FGC 2026 — Meeting Compliance & Documentation Tracker

A calendar-driven compliance tracker. The admin marks meeting days; each meeting day
carries a checklist of required submissions; the system flags missed days, missing
compulsory items, and overdue deadlines on a red/amber/green dashboard.

Runs entirely on the Cloudflare free tier ($0): Pages (frontend), Workers (API),
D1 (database), R2 (media).

## Prerequisites

- A free Cloudflare account
- Node.js 20+ and npm

## Auth (Supabase magic link)

Login is passwordless: a member enters their email and clicks a sign in link.
Anyone with a valid email can sign in as a member. One account is the admin
(set by `ADMIN_EMAIL`, default `vibha.aarav@gmail.com`); the admin manages the
roster and requirement templates.

### Supabase setup (one time)

1. Create a free project at supabase.com (or reuse an existing one).
2. Project Settings > API: copy the **Project URL** and the **anon / publishable** key.
3. Put them where the app reads them:
   - `frontend/.env` (see `frontend/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `.dev.vars` (see `.dev.vars.example`): `SUPABASE_ANON_KEY` (for local `wrangler dev`)
   - `wrangler.toml` `[vars]`: `SUPABASE_URL`, `ADMIN_EMAIL`
4. Authentication > URL Configuration: add `http://localhost:5173` (and later your
   Pages URL) to the redirect allowlist, or the magic link will not return to the app.

Note: Supabase's built-in mailer rate-limits magic links (roughly 3 to 4 per hour)
and sends from a Supabase address. Fine for trickle signups. To onboard the whole
team at once, configure custom SMTP in the Supabase dashboard.

## Local development

```bash
npm install
# Terminal 1: API (reads SUPABASE_ANON_KEY from .dev.vars, vars from wrangler.toml)
npx wrangler dev
# Terminal 2: frontend (proxies /api to the worker, reads frontend/.env)
npm run dev --workspace @weeklog/frontend
```

## First-time Cloudflare setup

```bash
npx wrangler login

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create weeklog

# 2. Create the R2 bucket
npx wrangler r2 bucket create weeklog-media

# 3. Apply migrations + seeds to the remote DB
npx wrangler d1 migrations apply weeklog --remote
npx wrangler d1 execute weeklog --remote --file worker/seed/roster.sql

# 4. Provide the Supabase publishable key to the deployed worker
npx wrangler secret put SUPABASE_ANON_KEY

# 5. Deploy the worker
npx wrangler deploy
```

## Frontend (Cloudflare Pages)

Build command: `npm run build --workspace @weeklog/frontend`
Output directory: `frontend/dist`
Connect the repo in the Cloudflare Pages dashboard and set those values, or run
`npx wrangler pages deploy frontend/dist`.

## Free-tier sanity

- D1: 5 GB storage, 5M rows read/day free.
- R2: 10 GB storage, no egress fees.
- Workers: 100k requests/day free.
- Pages: unlimited static requests free.

All well within a 21-member team's usage.

## Project structure

- `types/` shared TypeScript domain types
- `worker/` Hono API, D1 migrations + seeds
- `frontend/` React + Vite app
