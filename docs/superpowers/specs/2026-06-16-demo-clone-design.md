# Demo Clone — Design Spec

**Date:** 2026-06-16
**Branch:** `demo` (off `master`)
**Goal:** A fully interactive, backend-free demo of the WeekLog app, deployable as a separate Cloudflare Pages site, using real Supabase magic-link auth but no Worker / D1 / R2.

---

## 1. Context & strategy

Every data call in the frontend funnels through four functions in
`frontend/src/lib/api.ts` — `api()`, `apiForm()`, `apiBlobUrl()`,
`downloadAuthed()`. All feature hooks (`useCalendar`, `useMeetingDay`,
`useDashboard`, `useDeadlines`, `useBrowse`, `useMembers`, `useTemplates`,
`useMediaUrl`) and `AuthProvider` sit on top of those four. `isAdmin` is decided
by `GET /api/me`.

Therefore the whole backend can be replaced by swapping the **implementation** of
those four functions while keeping their **signatures** identical. Nothing else
in the app changes. This swap happens **only on the `demo` branch**.

Auth stays fully real: `supabase.ts` and `AuthProvider.tsx` are untouched. Users
sign in with the existing Supabase email magic-link flow.

## 2. Locked decisions

- **Persistence:** localStorage-backed store seeded on first visit; visitor
  mutations persist across refreshes. A **"Reset demo"** control restores the seed.
- **Auth:** existing Supabase email magic-link, unchanged.
- **Roles:** every signed-in visitor is admin (`/api/me → isAdmin: true`).
- **Seed data:** freshly invented generic sample (not the real `0002_seed.sql`).

## 3. Architecture

New modules, all under `frontend/src/lib/demo/`:

| File | Responsibility |
|---|---|
| `seed.ts` | Invented sample dataset: committees, ~8 members, requirement templates, ~6 meeting days in varied states (some all-green, some with missing compulsory items), submissions, attendance rows, deadlines, and 2–3 bundled placeholder media images. Returns a deep-cloned fresh copy on demand. |
| `store.ts` | localStorage-backed data graph. Loads seed on first visit; persists every mutation; exposes `reset()` to restore the seed. Single localStorage key (e.g. `weeklog-demo-v1`). |
| `compute.ts` | Pure derived-view functions ported from `worker/src/{summary.ts,status.ts,dayStatus.ts}` and the meeting-day/dashboard route handlers: meeting-day detail (requirements with `status`, `missingCompulsory`, RAG), dashboard health, per-day calendar status, search/browse filtering. |
| `router.ts` | Maps `method + path` (regex match, with params) to a handler that reads/writes `store` and returns plain JSON objects. Covers the full endpoint surface in §4. |
| `media.ts` | In-memory `Map<id, objectURL>` for uploaded blobs + bundled seed-image URLs; backs `apiBlobUrl`. |

**`frontend/src/lib/api.ts` (replaced on `demo` branch):** the four exported
functions keep identical signatures but delegate to `router.ts` (and `media.ts`
for blobs) instead of `fetch`. The Supabase token logic is dropped here since
there is no Worker to authorize against; auth still gates the UI via
`AuthProvider` (no session → Login screen).

**Reset UI:** a small "DEMO" pill rendered in the existing shell (sidebar footer
on desktop, header on mobile) with a "Reset data" action that calls
`store.reset()` and reloads. New, self-contained component; no change to nav logic.

## 4. Endpoint surface the router must implement

Auth/identity:
- `GET /api/me` → `{ email, isAdmin: true }`
- `GET /api/drive/status` → `{ configured: false }`

Calendar / meeting days:
- `GET /api/meeting-days?from=&to=` → `MeetingDayLite[]`
- `POST /api/meeting-days` `{date, title}`
- `GET /api/meeting-days/:id` → `MeetingDayDetail`
- `PATCH /api/meeting-days/:id` `{title}`
- `DELETE /api/meeting-days/:id`

Meeting-day detail:
- `GET /api/meeting-days/:id/attendance` → `AttendanceRow[]`
- `POST /api/meeting-days/:id/attendance` `{member_id, present}`
- `GET /api/meeting-days/:id/submissions` → `Submission[]`
- `POST /api/meeting-days/:id/submissions` `{kind, content, requirementId, subsystem}`
- `GET /api/meeting-days/:id/media` → `MediaRow[]`
- `POST /api/meeting-days/:id/media` (multipart form)
- `GET /api/meeting-days/:id/requirements/available` → `AvailableRequirement[]`
- `POST /api/meeting-days/:id/requirements` `{templateId} | {label, compulsory, expectedKind}`
- `PATCH /api/meeting-days/:id/requirements/:reqId` `{compulsory}`
- `DELETE /api/meeting-days/:id/requirements/:reqId`
- `GET /api/meeting-days/:id/zip` (stub manifest download)

Dashboard:
- `GET /api/dashboard` → `Dashboard`
- `GET /api/export/all-media/zip` (stub manifest download)

Deadlines:
- `GET /api/deadlines` → `Deadline[]`
- `POST /api/deadlines` `{...}`
- `POST /api/deadlines/:id/done`
- `POST /api/deadlines/:id/reopen`
- `DELETE /api/deadlines/:id`
- `GET /api/deadlines/:id/media` → `MediaRow[]`
- `POST /api/deadlines/:id/media` (multipart form)

Browse / search:
- `GET /api/submissions?...` → `Submission[]`
- `POST /api/submissions/:id/resolve` / `/unresolve`
- `GET /api/search?...` → `Submission[]`

Media:
- `GET /api/media/:id/file` (blob via `apiBlobUrl`)

Templates:
- `GET /api/requirement-templates` → `Template[]`
- `POST /api/requirement-templates` `{...}`
- `PATCH /api/requirement-templates/:id` `{...}`
- `POST /api/requirement-templates/reorder` `{...}`

Members:
- `GET /api/members` → `Member[]`
- `GET /api/committees` → `Committee[]`
- `POST /api/members` `{name, committeeIds}`
- `PATCH /api/members/:id` `{patch}`

All response shapes are the existing types in
`frontend/src/lib/hooks/types.ts` — the router must satisfy those exactly so no
hook or component changes.

## 5. Known demo simplifications (documented in README + UI)

- **Media uploads:** metadata persists in the store; uploaded binary is held as
  an in-memory object URL only (localStorage can't hold real binaries). After a
  refresh, an uploaded image whose blob is gone falls back to a placeholder.
  Seed images are bundled static assets and always render.
- **ZIP / Drive exports:** ZIP buttons download a small generated manifest
  (text) so the action succeeds without a backend; Google Drive export shows as
  "not configured."

## 6. Deployment

- Build needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  `VITE_API_BASE` is intentionally absent (no Worker).
- Push branch `demo`; deploy as a separate Cloudflare Pages project tracking the
  `demo` branch. Supabase Auth "Site URL" / redirect allow-list must include the
  demo's URL for magic-link to land correctly.
- A short `DEMO.md` (or README section on the branch) documents what the demo is,
  the simplifications above, and how to reset.

## 7. Testing

- Port-faithfulness: unit tests for `compute.ts` (requirement status,
  `missingCompulsory`, RAG, dashboard health) against small fixtures, mirroring
  the existing Worker tests' expectations.
- Router contract: tests asserting each endpoint returns the shape its hook
  expects and that mutations persist through `store`.
- `reset()` restores the exact seed.
- Existing frontend tests (`api.test.ts`, hook tests) are adjusted only where they
  assert the now-removed `fetch`/token wiring; feature-level tests stay green.

## 8. Out of scope

- No changes to `master`'s Worker, frontend, or data layer.
- No real file storage, no real export generation, no Drive integration.
- No new auth providers (Google OAuth explicitly deferred — magic-link only).
