# Team Qatar Logbook, Project Summary

A meeting compliance and documentation tracker for **Team Qatar** (FIRST Global
Challenge 2026 robotics team, ~21 members). The spine of the app is a **calendar
that creates obligations**, surfaced as a **red / amber / green (RAG) compliance
dashboard**. It also tracks standalone deadlines (social media challenges, etc.)
and lets the team attach photo/document proof, then export everything as ZIPs.

This document is the single source of truth for what was built, where it lives,
how to run it, and what is left to do.

Last updated: 2026-06-09.

---

## 1. Live URLs

| What | URL |
| --- | --- |
| **Public app (share this)** | https://weeklog.pages.dev |
| API (Worker) | https://weeklog-worker.fgcworker.workers.dev |
| Health check | https://weeklog-worker.fgcworker.workers.dev/api/health |

The app is a static site on Cloudflare Pages that talks to the Worker API. The
Worker URL is baked into the frontend bundle at build time via `VITE_API_BASE`.

---

## 2. Status

**Feature-complete and deployed.** All 9 PRD build phases are done, the design
restyle is merged, and the whole stack is live on Cloudflare's free tier.

One manual step remains (see section 12): set the Supabase **Site URL** to
`https://weeklog.pages.dev` so magic-link emails stop redirecting to localhost.

---

## 3. Tech stack

All Cloudflare, all free tier, total cost target **$0**.

- **Frontend**: React + Vite + TypeScript, deployed as a static SPA on
  **Cloudflare Pages**. Dark editorial theme with Qatar maroon brand chrome.
- **API**: TypeScript + **Hono** on **Cloudflare Workers**.
- **Database**: **Cloudflare D1** (SQLite).
- **Media storage**: **Cloudflare R2** (object storage; no egress fees).
- **Auth**: **Supabase** magic-link (passwordless email). The Worker verifies
  bearer tokens against Supabase; no JWT secret is stored.
- **Tests**: Vitest (worker + frontend).
- **Tooling**: npm workspaces monorepo, wrangler for deploy.

---

## 4. Repository layout

```
C:\FGC-2026-WeekLog\
├─ package.json            # npm workspaces root + scripts (test/verify/migrate/seed/setup)
├─ wrangler.toml           # Worker config: D1 + R2 bindings, vars, CORS origin
├─ .dev.vars              # LOCAL secret: SUPABASE_ANON_KEY (gitignored)
├─ .dev.vars.example       # template (committed)
├─ README.md              # deploy guide
├─ DESIGN.md              # design-agent handoff (what is editable vs protected)
├─ PROJECT-SUMMARY.md      # this file
│
├─ types/                 # shared TypeScript types (workspace @weeklog/types)
│
├─ worker/                # the API (workspace @weeklog/worker)
│  ├─ src/
│  │  ├─ index.ts         # Hono app, CORS, route mounting, onError handler
│  │  ├─ bindings.ts      # Env bindings + types
│  │  ├─ auth.ts          # Supabase token verify, isAdmin, requireUser/requireAdmin
│  │  ├─ compliance.ts    # pure RAG rules: dayRag(), deadlineRag(), date math
│  │  ├─ status.ts        # per-requirement submitted/missing derivation
│  │  ├─ dayStatus.ts     # deriveDay(), recomputeDayCache(), day RAG
│  │  ├─ snapshot.ts      # freezes active templates into a meeting day
│  │  ├─ summary.ts       # day summary (json + markdown + media list)
│  │  ├─ storage.ts       # R2 free-tier guard (size cap + storage ceiling)
│  │  ├─ names.ts         # human-readable ZIP folder/file names
│  │  ├─ drive.ts         # Google Drive connector interface (Null stub for now)
│  │  └─ routes/          # members, templates, meetingDays, submissions, media,
│  │                      #   deadlines, dashboard, search, exports, drive
│  ├─ migrations/         # 0001_init .. 0005_media_bytes (D1 schema)
│  ├─ seed/roster.sql     # 21 members across committees
│  └─ test/               # 71 worker tests + helpers (better-sqlite3 D1 shim)
│
└─ frontend/             # the UI (workspace @weeklog/frontend)
   ├─ .env               # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (gitignored)
   ├─ .env.example        # template (committed)
   ├─ public/team-qatar-logo.png
   └─ src/
      ├─ main.tsx         # entry; imports theme CSS
      ├─ App.tsx          # app shell, nav, auth gating
      ├─ lib/             # PROTECTED WIRING (do not edit during design work)
      │  ├─ supabase.ts   # Supabase client
      │  ├─ api.ts        # api()/apiForm()/apiBlobUrl() + token refresh + API base
      │  ├─ dates.ts      # calendar date helpers
      │  └─ hooks/        # one typed hook per feature (useDashboard, useCalendar,
      │                   #   useMeetingDay, useDeadlines, useBrowse, useMembers,
      │                   #   useTemplates, useMediaUrl) + shared types
      ├─ auth/
      │  ├─ AuthProvider.tsx  # PROTECTED: session/role context, useAuth()
      │  └─ Login.tsx         # magic-link login screen (design surface)
      ├─ ui/              # presentational helpers: Icon, primitives (RagTag, etc.)
      ├─ theme/           # base.css + app.css (design tokens, fonts)
      └─ dashboard/ calendar/ deadlines/ browse/ admin/   # feature screens
```

---

## 5. Data model (D1 tables)

Defined across migrations `0001_init.sql` through `0005_media_bytes.sql`:

- **members** — roster (name, committee, active). 21 seeded.
- **requirement_templates** — the reusable obligations (label, description,
  compulsory, expected_kind, sort_order, active). 9 seeded.
- **meeting_days** — a marked day on the calendar (date, title, cached status).
- **meeting_requirements** — a snapshot of the active templates frozen into a
  specific meeting day, with a cached derived `status`.
- **attendance** — per member per day (present 0/1).
- **submissions** — text artifacts logged against a day (kind, subsystem,
  content, optional requirement link, resolved flag for build-needs).
- **deadlines** — standalone obligations (title, due_date, category, link,
  status). 1 example seeded.
- **media** — uploaded files in R2 (r2_key, content_type, caption, kind,
  **bytes**, linked to a meeting day OR a deadline OR a requirement).

`bytes` (migration 0005) was added so the Worker can sum total storage and
enforce the R2 free-tier ceiling.

---

## 6. Compliance / RAG logic (the heart of the app)

- A **meeting day** is **green** if all compulsory requirements are satisfied,
  **amber** if it is today/recent with items still open, **red** if a past day
  has missing compulsory items. Logic is pure and testable in
  `compliance.ts` (`dayRag`) and `dayStatus.ts`.
- A **deadline** is **green** when done, **red** when overdue, **amber** when due
  soon, computed in `deadlineRag`.
- The **dashboard** (`/api/dashboard`) aggregates all days and deadlines into an
  overall RAG plus "needs attention", "this week", and "upcoming deadlines".
- RAG is always shown as **icon + label**, never color alone (accessibility).

---

## 7. Auth model

- **Passwordless magic link** via Supabase. Anyone with a valid email can sign
  up as a member.
- **Single admin**: `vibha.aarav@gmail.com` (set as `ADMIN_EMAIL` in
  `wrangler.toml`). Admin-only screens (Members, Requirements) render only when
  `useAuth().isAdmin` is true.
- The Worker verifies each request's bearer token by calling
  `GET {SUPABASE_URL}/auth/v1/user` with the publishable key as `apikey`. The
  JWT secret is never used or stored.
- The Supabase project: https://supabase.com/dashboard/project/euzvqdnonmkechsdtryr

---

## 8. R2 free-tier guard (your "never exceed free tier" rule)

R2's free tier is **10 GB-month** of storage, **1M** class-A (write) ops, and
**10M** class-B (read) ops per month, with **no egress fees**. Storage volume is
the only realistic overage risk for ~21 users, so the Worker enforces hard
limits in `worker/src/storage.ts`:

- **10 MB per file** cap (returns 413 if exceeded).
- **8 GB total storage ceiling** (returns 507 when a new upload would cross it).
  This is a 2 GB safety margin under the 10 GB free limit.

Every upload records its byte size in `media.bytes`; the guard sums that column
before allowing a new write. Both upload paths (meeting-day media and deadline
proof) go through the guard. 5 dedicated tests cover it.

**To stay $0 you do not need to do anything else.** The only way to exceed the
free tier would be to manually raise those constants in `storage.ts`.

---

## 9. The design seam (why the UI was safe to restyle)

All network/auth/data wiring is isolated into `frontend/src/lib/**` and
`frontend/src/auth/AuthProvider.tsx`, each marked with a `PROTECTED WIRING`
header. Feature components are pure presentation that consume typed hooks
(`useDashboard()`, `useMeetingDay()`, `useAuth()`, etc.) and never write a
fetch, URL, or token. This let the "claude design" restyle be merged as a
drop-in without touching how anything works. `DESIGN.md` documents the rules and
`npm run verify` is the gate that proves the wiring is intact.

---

## 10. Deployed Cloudflare resources

Account: `vibha.aarav@gmail.com` (account id `58b26a09b06d1997d680eadd73b4576e`).

| Resource | Name / value |
| --- | --- |
| Worker | `weeklog-worker` → https://weeklog-worker.fgcworker.workers.dev |
| workers.dev subdomain | `fgcworker` (account-wide) |
| Pages project | `weeklog` → https://weeklog.pages.dev (production branch `main`) |
| D1 database | `weeklog`, id `002c3ab7-b1eb-49eb-91e7-a52d8112cad6` |
| R2 bucket | `weeklog-media` |
| Worker secret | `SUPABASE_ANON_KEY` (publishable key, set via `wrangler secret put`) |
| Worker vars | `SUPABASE_URL`, `ADMIN_EMAIL`, `FRONTEND_ORIGIN=https://weeklog.pages.dev` |

CORS is locked to `https://weeklog.pages.dev` (verified).

---

## 11. Config and secrets, where everything lives

- **`wrangler.toml`** (committed): D1 + R2 bindings, public vars (`SUPABASE_URL`,
  `ADMIN_EMAIL`, `FRONTEND_ORIGIN`), and the D1 `database_id`.
- **`.dev.vars`** (gitignored): `SUPABASE_ANON_KEY` for local Worker dev.
- **`frontend/.env`** (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Note: it intentionally does NOT set `VITE_API_BASE`, so local dev uses the Vite
  proxy. The production value is injected only at build time (see section 13).
- **Worker secret** `SUPABASE_ANON_KEY`: stored in Cloudflare, not in the repo.

The Supabase publishable key (`sb_publishable_...`) is a public key, but it is
kept out of committed files as good hygiene; only `.example` templates are
committed.

---

## 12. The one manual step left

In the Supabase dashboard
(https://supabase.com/dashboard/project/euzvqdnonmkechsdtryr/auth/url-configuration):

1. **Site URL** → `https://weeklog.pages.dev` (this is the fix for magic links
   bouncing to `localhost:3000`, which is Supabase's default Site URL).
2. **Redirect URLs** → add **both** `https://weeklog.pages.dev` and
   `https://weeklog.pages.dev/**` (the bare origin is required because the app
   sends a no-trailing-slash redirect that the `/**` pattern alone will not
   match).
3. Save.

Then always **start login from https://weeklog.pages.dev** (not localhost), or
the app will send `localhost` as the redirect and the link will not return.

---

## 13. Local development

Two terminals from the repo root:

```powershell
# Terminal 1: the API (local D1 + R2)
npx wrangler dev                 # http://127.0.0.1:8787

# Terminal 2: the UI (proxies /api to the local Worker)
npm run dev --workspace @weeklog/frontend   # http://localhost:5173
```

First-time local setup (creates/migrates/seeds the LOCAL D1):

```powershell
npm run setup:local
```

Run the full quality gate (typecheck + all tests + build):

```powershell
npm run verify
```

---

## 14. How to redeploy after changes

**Worker (API) changes:**

```powershell
npx wrangler deploy
```

**Frontend changes** (must bake in the Worker URL, then publish the static build):

```powershell
$env:VITE_API_BASE = "https://weeklog-worker.fgcworker.workers.dev"
npm run build --workspace @weeklog/frontend
Remove-Item Env:\VITE_API_BASE
npx wrangler pages deploy frontend/dist --project-name weeklog --branch main --commit-dirty=true
```

**Database schema change:** add a new `worker/migrations/000N_*.sql`, then:

```powershell
npm run migrate:remote      # applies to the live D1
```

Tip: after a frontend deploy, hard-reload the browser (Ctrl+Shift+R) to bypass
the cached bundle.

---

## 15. Git state

- Active branch: **`design`** — holds the restyle, the storage guard, and all
  deploy config. This is what is currently deployed.
- **`master`** — the pre-restyle baseline. Not yet merged.
- **Next git step (your call):** merge `design` into `master` when you are happy
  with the live site.

Recent commits on `design`:

```
6806823 feat(deadlines): attach multiple proof files per deadline
755fe9f feat(worker): add onError handler that logs stack and returns the message
441bd7a chore(deploy): wire production D1 id and lock CORS to the Pages origin
3b4c897 feat(worker): enforce R2 storage budget so uploads cannot exceed the free tier
2109c4b feat(frontend): merge Team Qatar restyle from design handoff
```

---

## 16. Free-tier limits at a glance

| Service | Free limit | This app's usage |
| --- | --- | --- |
| Workers | 100k requests/day | Tiny (a team of ~21) |
| Pages | Unlimited static requests, 500 builds/mo | Manual deploys only |
| D1 | 5 GB storage, 5M reads/day, 100k writes/day | Kilobytes, light traffic |
| R2 | 10 GB storage, 1M writes/mo, 10M reads/mo, $0 egress | Guarded at 8 GB / 10 MB per file |
| Supabase | 50k MAU, generous auth | One admin + ~21 members |

---

## 17. Things worth remembering (gotchas)

- **No em dashes** in any UI copy (hard project rule). Use commas/periods.
- **Magic links return to wherever you started login from.** Start at
  weeklog.pages.dev; old localhost links will be `otp_expired` or bounce.
- **The frontend's API base is build-time only.** If you forget to set
  `VITE_API_BASE` when building for deploy, the app will call same-origin `/api`
  on pages.dev and fail. The redeploy snippet in section 14 handles it.
- **Design work must keep `npm run verify` green** and must not edit
  `frontend/src/lib/**` or `auth/AuthProvider.tsx`.
- **Errors now surface clearly:** the Worker's `onError` handler returns the real
  message and logs the stack (view live with `npx wrangler tail weeklog-worker`).

---

## 18. Possible future work (not required)

- Merge `design` into `master`.
- Wire the real Google Drive connector (interface and Null stub already exist in
  `worker/src/drive.ts`; currently disabled).
- Add a delete control for individual deadline proof files (backend
  `DELETE /api/media/:id` already exists; would need a `remove` added to the
  `useDeadlineProof` hook).
- Custom domain on Pages instead of `weeklog.pages.dev`.
