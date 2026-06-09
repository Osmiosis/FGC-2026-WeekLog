# Team Qatar FGC 2026 — Meeting Compliance & Documentation Tracker

A calendar-driven compliance tracker. The admin marks meeting days; each meeting day
carries a checklist of required submissions; the system flags missed days, missing
compulsory items, and overdue deadlines on a red/amber/green dashboard.

Runs entirely on the Cloudflare free tier ($0): Pages (frontend), Workers (API),
D1 (database), R2 (media).

## Prerequisites

- A free Cloudflare account
- Node.js 20+ and npm

## Local development

```bash
npm install
# Terminal 1: API
npx wrangler dev
# Terminal 2: frontend (proxies /api to the worker)
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

# 4. Set auth secrets (store only hashes; see auth phase for hashing)
npx wrangler secret put TEAM_PASSWORD_HASH
npx wrangler secret put ADMIN_PASSWORD_HASH

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
