# Progress Summary — Per-Meeting Editable Requirements

**Date:** 2026-06-10
**Branch:** `feat/per-meeting-requirements` (6 commits, off `master`)
**Status:** Feature complete — 78/81 worker tests pass (3 failures are pre-existing/unrelated `storageGuard` tests), frontend `tsc --noEmit` + `vite build` clean.

---

## What was built

Admins can now deviate a single meeting's requirements from the default template set, **after** the meeting is created, from the meeting detail page — without touching the global templates or any other meeting. Four kinds of change are supported per meeting:

1. **Toggle** a requirement compulsory ↔ voluntary (affects that day's red/amber/green status).
2. **Remove** a requirement that doesn't apply to the meeting (soft-delete — uploaded files/submissions are kept).
3. **Re-add** a default (template) requirement that was removed or never present.
4. **Add a custom one-off** requirement that isn't in the global templates at all.

All editing is **admin-only**; members see the checklist exactly as before, with no edit controls.

### Key design decision
`meeting_requirements` was already a per-meeting **snapshot** of each requirement (one row per requirement, with its own `compulsory` flag). Rather than add a separate overrides table, we made those existing rows editable in place. Day RAG status recomputes for free because `dayStatus.ts` already reads `compulsory`/`status` off these rows. **Remove is a soft-delete** (`active=0`) so it never orphans linked media/submissions and is reversible.

---

## Backend (Cloudflare Worker + D1)

### Data model — migration `worker/migrations/0006_meeting_requirements_editable.sql`
Added two columns to `meeting_requirements`:
- `active INTEGER NOT NULL DEFAULT 1` — soft-remove flag (`0` = removed from checklist, row preserved).
- `custom INTEGER NOT NULL DEFAULT 0` — marks a one-off requirement not backed by a template (`template_id` stays `NULL`).

All requirement reads now filter `active=1`. The single read path is `deriveDay()` in `worker/src/dayStatus.ts`, which every caller (day detail, calendar list, ZIP/summary export) routes through, so the filter applies everywhere. `custom` is carried through `ReqRow` (`worker/src/status.ts`) so it reaches the API response and the frontend.

### New admin API routes (in `worker/src/routes/meetingDays.ts`, all `requireAdmin`)

| Method | Path | Body | Behavior |
|--------|------|------|----------|
| `PATCH` | `/api/meeting-days/:id/requirements/:reqId` | `{ compulsory: 0\|1 }` | Flip compulsory for that one requirement. 400 on bad value, 404 if not on the day. |
| `DELETE` | `/api/meeting-days/:id/requirements/:reqId` | — | Soft-remove (`active=0`). 404 if not found. Linked media/submissions preserved. |
| `POST` | `/api/meeting-days/:id/requirements` | `{ templateId }` **or** `{ label, compulsory, expectedKind }` | Add a requirement (see below). 201 on success. |
| `GET` | `/api/meeting-days/:id/requirements/available` | — | Active templates with no `active=1` row on this meeting — populates the "add default" picker. |

**POST add semantics:**
- `{ templateId }` → if a `meeting_requirements` row for that template already exists (e.g. soft-removed), **reactivate** it (`active=1`) to preserve any linked data; otherwise **snapshot a fresh** row from the template (`status='missing'`, `custom=0`).
- `{ label, compulsory, expectedKind }` → insert a **custom** row (`template_id=NULL`, `custom=1`, `status='missing'`). `expectedKind` validated against `attendance|text|media|any` (400 otherwise).
- After any mutation the handler calls `recomputeDayCache()`, which re-derives every active requirement's submitted/missing status from live attendance/submissions/media — so a re-added requirement whose photo was preserved correctly shows as submitted.

Security: every route is admin-gated; requirements are scoped by `meeting_day_id` in the SQL (no cross-day IDOR); all queries parameterized.

---

## Frontend (React + Vite + TypeScript)

Wiring lives in the protected `src/lib` seam; components stay presentational.

### Seam — `frontend/src/lib/hooks/`
- `types.ts`: `Requirement` gained `custom: number`; new `AvailableRequirement` type for the picker.
- `useMeetingDay.ts`: added mutations `toggleCompulsory`, `removeRequirement`, `addRequirement`, and a `loadAvailable()` loader. Each mutation calls the API then `reload()`s the day, matching the existing hook pattern.

### UI — `frontend/src/calendar/MeetingDayDetail.tsx` (admin only)
- Each requirement card gains a **"Make voluntary/compulsory"** toggle and a **"Remove"** button (with a confirm dialog). A `· custom` badge marks one-off requirements.
- Below the checklist, a collapsible **"+ Add requirement"** panel with two paths: pick an unused template, or fill a small custom form (label + type select + compulsory checkbox).
- Styling matches the existing inline-style RAG palette (`#b4e0b8` / `#f3b4b4` / `#ddd` / `crimson`) — no new styling system. Non-admins see the unchanged checklist.

---

## Tests
- New `worker/test/meetingRequirements.test.ts` — 10 tests: default `active/custom` values, toggle + RAG, validation/gating (400/403/404), soft-remove (row preserved with `active=0`), available-templates filtering, re-add reactivates the same row with no duplicate (verified by `COUNT(*)=1`), and custom one-off persistence.
- `worker/test/helpers/d1.ts` updated to load migration 0006 in the in-memory test DB.
- Full worker suite: **78 passing**. The only 3 failures are in `storageGuard.test.ts` (missing `bytes` column from migration 0005, which the test helper has never loaded) — **pre-existing on `master`, unrelated to this work** (verified by running them on the base commit).
- Frontend: `tsc --noEmit` clean, `vite build` succeeds (91 modules).

---

## Commits (oldest → newest)
```
1a8b07b feat(worker): add active/custom columns for per-meeting requirement editing
41b15a0 feat(worker): PATCH route to toggle a meeting requirement compulsory/voluntary
7817401 feat(worker): DELETE route to soft-remove a meeting requirement
1bd95e2 feat(worker): GET available templates + POST add (re-add default or custom requirement)
2af770d feat(frontend): seam mutations for per-meeting requirement editing
06b6a75 feat(frontend): admin per-meeting requirement editing UI (toggle/remove/add)
```

Design spec: `docs/superpowers/specs/2026-06-10-per-meeting-requirements-design.md`
Implementation plan: `docs/superpowers/plans/2026-06-10-per-meeting-requirements.md`

---

## Process
Built with the GSD/superpowers flow: brainstorm → spec → plan → subagent-driven execution. Each of the 6 tasks was implemented by a fresh subagent under TDD, then passed a two-stage review (spec compliance, then code quality) before the next task started.

## Known non-blocking notes (candidates for a later polish pass)
- `GET /available` returns `[]` for a non-existent meeting id rather than 404 (read-only, admin-only).
- The "+ Add requirement" panel doesn't refresh its available-template list after adding a *custom* one-off (custom items aren't in that pool, so low impact).
- `loadAvailable()` failure in the panel surfaces silently as "(none available)" with no toast.
- Unhandled-JSON-parse on malformed request bodies returns 500 — a pre-existing pattern shared by all write routes in `meetingDays.ts`, not introduced here.

## Not yet done
- Live Cloudflare deploy of this branch (D1 migration 0006 + Worker + Pages).
- Merge `feat/per-meeting-requirements` → `master`.
