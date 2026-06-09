# Claude Code task: merge the restyled frontend and deploy

## Context

This is the Team Qatar FGC 2026 monorepo (`frontend/` React+Vite, `worker/` Hono
API on Cloudflare, shared `types/`). The app is functionally complete. A visual
restyle of the **frontend presentation layer only** has been produced and lives
in this `handoff/` folder. Your job is to merge it into `frontend/` and deploy so
it can be hosted. The backend, data layer, and auth are unchanged.

**Important:** unlike a typical design handoff, the files in `handoff/src/` are
**real, production-ready TypeScript/React** that already call the existing data
hooks with the correct arguments and snake_case field names. You are doing a
**merge**, not a reimplementation. Read `handoff/HANDOFF.md` first, it has the
exact file-by-file mapping.

## Hard guardrails (do not break the wiring)

Do NOT edit, move, or change the behavior/signatures of any of these:

- `frontend/src/lib/**` (Supabase client, `api()` helper, all data hooks, dates, types)
- `frontend/src/auth/AuthProvider.tsx` (keeps the `useAuth()` contract)
- `frontend/src/lib/supabase.ts` env var names + `isConfigured` guard
- Anything outside `frontend/`: `worker/`, `types/`, `wrangler.toml`, migrations,
  seeds, `.env` / `.dev.vars` and their examples

The restyled components get all data and actions from the existing hooks
(`useDashboard`, `useCalendar`, `useMeetingDay`, `useDeadlines`, `useBuildNeeds`,
`useSearch`, `useMembers`, `useTemplates`, `useMediaUrl`, `useAuth`). They must
keep doing so. No new fetch/URL/token code in components.

## Steps

1. Check out the `design` branch (per `DESIGN.md`), not `main`.

2. Copy the files using the mapping table in `handoff/HANDOFF.md`. This creates
   two new folders under `frontend/src/`: `ui/` (pure presentational helpers,
   nothing else imports it) and `theme/` (the two CSS files). It overwrites the
   placeholder-styled `App.tsx`, `auth/Login.tsx`, `dashboard/`, `calendar/`,
   `deadlines/`, `browse/`, and `admin/` components. Put `team-qatar-logo.png`
   in `frontend/public/`.

3. Wire the theme: in `frontend/src/main.tsx`, add at the top:
   ```ts
   import "./theme/base.css";
   import "./theme/app.css";
   ```
   `base.css` `@import`s Google fonts (Space Grotesk, Hanken Grotesk, Space Mono).

4. Reconcile the component prop contracts. The new `App.tsx` renders:
   - `<Dashboard wide onOpenDay onGoToDeadlines />`
   - `<CalendarView initialOpenDayId />`  (renders `MeetingDayDetail` internally)
   - `<DeadlinesView wide />`
   - `<BrowseView onOpenDay wide />`
   - `<MembersAdmin />`, `<TemplatesAdmin />`
   These match the shipped components. If your current `App.tsx` had any extra
   props, prefer the new `App.tsx` as-is.

5. Build and verify from the repo root:
   ```
   npm run verify        # typecheck + tests + build for the whole repo
   ```
   - If typecheck fails on `noUnusedLocals`/strict settings, remove the specific
     unused import it names. Do not loosen tsconfig.
   - If `frontend/src/App.smoke.test.tsx` asserts on old copy/markup that no
     longer exists, update the test to match the new UI. Test files are not
     protected wiring, editing them is fine. Do not change what the app sends to
     the API to make a test pass.

6. Manually sanity-check in dev (two terminals, per `README.md`):
   `npx wrangler dev` and `npm run dev --workspace @weeklog/frontend`. Confirm:
   magic-link login still sends and returns; after login the header/sidebar shows
   the email + role; admin can list/add/deactivate members and add/toggle/reorder
   requirement templates; the calendar marks days; a meeting day records
   attendance/submissions/media. All on a 375px-wide viewport too.

7. Deploy to Cloudflare (free tier) following the existing `README.md` "Deploy"
   section verbatim (D1 create, R2 create, `setup:remote`, `wrangler secret put
   SUPABASE_ANON_KEY`, `wrangler deploy`, then build the frontend with
   `VITE_API_BASE` set and `wrangler pages deploy frontend/dist`). Add the Pages
   URL to the Supabase redirect list and set `FRONTEND_ORIGIN`, then redeploy the
   worker to lock CORS. Do not introduce paid services.

## Definition of done

- `npm run verify` is green (wiring intact).
- Login sends a magic link and returns to the app; role gating works (Members and
  Requirements only render for admin).
- Looks good and is fully usable at 375px wide and on desktop.
- No em dashes anywhere in copy (hard project rule).
- The app is deployed to a Cloudflare Pages URL and loads against the Worker API.

---

## Paste-in prompt for Claude Code

> Read `handoff/HANDOFF.md` and `handoff/CLAUDE_CODE.md`, then merge the restyled
> frontend in `handoff/src/` into `frontend/src/` on the `design` branch. Copy
> files per the mapping table, add the two CSS imports to `main.tsx`, and put the
> logo in `frontend/public/`. Do not touch `frontend/src/lib/**`,
> `auth/AuthProvider.tsx`, or anything outside `frontend/`. The components already
> call the existing hooks, keep those calls unchanged. Run `npm run verify` and
> fix only unused-import or smoke-test breakages (never change API payloads). Then
> follow the README to deploy to Cloudflare Pages + Workers so it can be hosted.
> No em dashes in any copy.
