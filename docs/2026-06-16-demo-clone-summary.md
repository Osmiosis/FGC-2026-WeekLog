# Session summary — 2026-06-16

Two things were requested: (1) confirm attendance trackers use member names, and
(2) build a backend-free demo clone of the app on a branch in the same repo.

## 1. Attendance trackers — verified, no change needed

The meeting-day attendance tracker keys on **members**, not committees:

- API `worker/src/routes/meetingDays.ts:86` returns one row per active member
  (`member_id`, `name`), with committees only `GROUP_CONCAT`'d in as a secondary field.
- Type `AttendanceRow` (`frontend/src/lib/hooks/types.ts:60`): `{ member_id, name, committees[], present }`.
- UI `frontend/src/calendar/MeetingDayDetail.tsx:150-159`: each chip shows `a.name`
  as the primary label; committees are a tiny 9px caption underneath. Toggling
  present posts `a.member_id`.

Conclusion: presence is tracked per member name; committees are display-only. No code change.

## 2. Demo clone — built and pushed

**Branch:** `demo` (pushed to `github.com/Osmiosis/FGC-2026-WeekLog`).
**What it is:** a full, interactive clone with **no backend** — no Cloudflare
Worker, no D1, no R2. Real Supabase magic-link auth is kept; everyone signed in is
admin; all data is seeded sample data living in the browser's `localStorage`.

### How it works
Every data call already funneled through four functions in `frontend/src/lib/api.ts`.
On the `demo` branch those now delegate to a new in-browser mock instead of `fetch`.
New modules under `frontend/src/lib/demo/`:

| File | Responsibility |
|---|---|
| `types.ts` | Normalized table-row types (`DemoDB`). |
| `compute.ts` | RAG + requirement-status derivation, ported verbatim from the Worker. |
| `seed.ts` | Evergreen sample data (dates relative to today → realistic health spread). |
| `store.ts` | localStorage load/save/reset (key `weeklog-demo-v1`). |
| `media.ts` | In-memory blob registry + placeholder image. |
| `router.ts` | Maps every `/api/...` request to a handler over the local data. |

`api.ts` was swapped to delegate to the router. A `DemoBadge` (`frontend/src/ui/DemoBadge.tsx`)
adds a bottom-right "DEMO · Reset" pill. Auth files (`supabase.ts`, `AuthProvider.tsx`)
were untouched.

### Quality
Built task-by-task with fresh subagents and independent reviews on the substantive
pieces (compute, router, api swap). **40/40 tests pass, clean production build, tsc clean.**

### Known demo simplifications (also in `DEMO.md`)
- Uploaded media: metadata persists, but the image blob is in-memory only → shows a
  placeholder after a refresh. Seeded media always render.
- ZIP / Drive export: ZIP downloads a small text manifest (no real zipping); Drive
  export shows "not configured."

## Hosting (Cloudflare Pages)

The demo is a static SPA — Cloudflare Pages works with no Worker. New Pages project:

| Setting | Value |
|---|---|
| Production branch | `demo` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output dir | `dist` |
| Env var | `VITE_SUPABASE_URL = https://euzvqdnonmkechsdtryr.supabase.co` |
| Env var | `VITE_SUPABASE_ANON_KEY = sb_publishable_1DdJi5c9yv2_e2zAbSlNyw_RQWbxU3z` |

Do **not** set `VITE_API_BASE` (no Worker for the demo).

**Required Supabase step:** in the same Supabase project's Auth → URL Configuration,
**add** the demo's Pages URL to the Site URL / redirect allow-list (keep the existing
`weeklog.pages.dev` entry too), or magic-link sign-in won't land correctly.

Note: the demo shares the **real** Supabase project, so it uses the same sign-in user
pool as production. Auth only gates the UI; the demo's data is the local sample and is
fully isolated from real D1/R2.

## Also done
- Your prior uncommitted WIP (roster visible to all + multi-file upload) was committed
  to **`master`** as commit `ad98662`, per your choice, before branching `demo`.
- A stray `nul` file artifact was removed.

## Reference docs in the repo
- `DEMO.md` — demo branch readme.
- `docs/superpowers/specs/2026-06-16-demo-clone-design.md` — design spec.
- `docs/superpowers/plans/2026-06-16-demo-clone.md` — full implementation plan.
