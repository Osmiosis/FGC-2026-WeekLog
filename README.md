# Team Qatar FGC 2026 — Meeting Compliance & Documentation Tracker

A calendar-driven compliance tracker for a FIRST Global Challenge robotics team. The
admin marks meeting days; each meeting day carries a checklist of required submissions;
the system continuously evaluates compliance and flags missed days, missing compulsory
items, and overdue deadlines on a red/amber/green dashboard.

Runs entirely on the Cloudflare free tier ($0): Pages (frontend), Workers (API), D1
(database), R2 (media). Auth is a passwordless Supabase magic link.

## Features

- **Calendar** of meeting days (single mark or bulk recurring, e.g. every Tuesday and
  Thursday). Marking a day snapshots the active requirement templates so later edits
  never rewrite history.
- **Meeting-day detail**: attendance, accomplishments / build needs / goals / failures,
  and media uploads, each tracked against the requirement checklist.
- **Compliance engine** (red/amber/green): green = all compulsory submitted, amber =
  in progress / upcoming, red = past and incomplete.
- **Dashboard**: overall team status, a "needs attention" list, this week, and upcoming
  deadlines.
- **Deadlines tracker**: admin create/edit, members mark done and attach proof media.
- **Browse / search** across submissions, plus an aggregated Open Build Needs view.
- **ZIP export** of a day or all media (foldered by date/title), and a stubbed Drive
  connector seam for a future one-folder sync.

## Roles

- **Member** (anyone who signs in): view everything, record attendance, add submissions,
  upload media, mark deadlines done, resolve build needs.
- **Admin** (the single `ADMIN_EMAIL`): all of the above, plus mark/unmark meeting days,
  edit requirement templates, manage the roster, and create/delete deadlines.

## Prerequisites

- A free Cloudflare account and a free Supabase project
- Node.js 20+ and npm

## Project structure

```
types/      shared TypeScript domain types
worker/     Hono API (Cloudflare Worker), D1 migrations + seeds
  migrations/   0001 schema, 0002 templates+deadline seed, 0003 media.content_type, 0004 submissions.resolved
  seed/         roster.sql (21 members across committees)
frontend/   React + Vite app (Cloudflare Pages)
```

## Local development

Create the two local env files (both are gitignored):

- `frontend/.env` from `frontend/.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; leave `VITE_API_BASE` empty)
- `.dev.vars` from `.dev.vars.example` (`SUPABASE_ANON_KEY`)

Then:

```bash
npm install
npm run setup:local          # apply migrations + seed the roster to the local D1
# Terminal 1: API on http://localhost:8787
npx wrangler dev
# Terminal 2: frontend on http://localhost:5173 (proxies /api to the Worker)
npm run dev --workspace @weeklog/frontend
```

Run the two servers in **separate terminals** (both are long-running).

## Supabase setup (one time)

1. Create a free project at supabase.com.
2. Project Settings > API: copy the **Project URL** and the **anon / publishable** key
   into `frontend/.env`, `.dev.vars`, and `wrangler.toml` (`SUPABASE_URL`).
3. Authentication > URL Configuration: set the **Site URL** and add a **Redirect URL**
   for each environment you use (`http://localhost:5173` for dev, your Pages URL for prod).
   The magic link will not return to the app otherwise.
4. Set `ADMIN_EMAIL` in `wrangler.toml` to the admin's email.

Note: Supabase's built-in mailer rate-limits magic links (~2-4/hour). To send more,
configure custom SMTP in the Supabase dashboard (Authentication > Emails), then raise the
limit under Authentication > Rate Limits.

## Deploy to Cloudflare (free tier)

Assumes only a Cloudflare account + Node installed.

```bash
npx wrangler login

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create weeklog

# 2. Create the R2 bucket
npx wrangler r2 bucket create weeklog-media

# 3. Apply all migrations + seed the roster to the remote DB
npm run setup:remote

# 4. Config: SUPABASE_URL / ADMIN_EMAIL / (optional) FRONTEND_ORIGIN live in wrangler.toml [vars].
#    The publishable key is a secret:
npx wrangler secret put SUPABASE_ANON_KEY

# 5. Deploy the Worker (note its URL, e.g. https://weeklog-worker.YOURNAME.workers.dev)
npx wrangler deploy
```

### Frontend (Cloudflare Pages)

Build the frontend with the Worker URL baked in, then deploy the static output:

```bash
# set VITE_API_BASE to the Worker URL from step 5, plus your Supabase vars
npm run build --workspace @weeklog/frontend
npx wrangler pages deploy frontend/dist
```

Or connect the repo in the Cloudflare Pages dashboard with build command
`npm run build --workspace @weeklog/frontend`, output directory `frontend/dist`, and the
`VITE_*` variables set in the Pages project settings.

Finally, set `FRONTEND_ORIGIN` in `wrangler.toml` to the Pages URL and re-run
`npx wrangler deploy` to lock CORS, and add the Pages URL to the Supabase redirect list.

## Free-tier sanity

| Service | Free limit | This app |
| --- | --- | --- |
| Workers | 100k requests/day | Worker bundle ~29 KiB gzipped (limit 1 MB) |
| Pages | unlimited static requests | frontend ~108 KiB gzipped |
| D1 | 5 GB, 5M row reads/day | a season of meetings is a few thousand rows |
| R2 | 10 GB, no egress fees | media for a 21-member team |

No paid services, no always-on server, no cron or durable objects. $0.

## API overview

All routes are under `/api` and require a Supabase bearer token (admin-only where noted).

- `GET /health`, `GET /me`
- `members` (admin writes), `requirement-templates` (admin writes, `/reorder`)
- `meeting-days` (admin mark/unmark/bulk), `/:id` detail, `/:id/attendance|submissions|media`, `/:id/zip`
- `submissions/:id` delete + `/resolve` `/unresolve`; `media/:id/file` (authed stream)
- `deadlines` (admin writes, member `/:id/done`, `/:id/media`)
- `dashboard`, `search`, `build-needs`, `export/all-media/zip`, `drive/status`

## Google Drive (stubbed)

v1 ships a `NullDriveConnector` (`worker/src/drive.ts`); `getDriveConnector(env)` returns
a real connector when `DRIVE_ENABLED=1`. Until then, use the ZIP export to upload to the
mentors' Drive manually. A future `R2ToDriveConnector` drops in with no UI or core changes.

## Acceptance criteria (PRD Section 11)

- [x] Runs entirely on the Cloudflare free tier, $0.
- [x] Admin can mark a recurring meeting schedule in under a minute (bulk mark).
- [x] A past meeting day missing any compulsory item shows red automatically.
- [x] A fully-submitted meeting day shows green automatically.
- [x] An overdue deadline shows red; one due within 7 days shows amber.
- [x] Requirement templates are editable and changes do not rewrite snapshotted past days.
- [x] A member can submit a day's materials on a phone (responsive web).
- [x] No em dashes anywhere in UI copy.
- [x] Real Drive sync can be enabled later by adding a connector + config, no rewrite.
```
