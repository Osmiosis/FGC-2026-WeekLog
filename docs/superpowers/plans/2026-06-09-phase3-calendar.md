# Phase 3: Calendar + Meeting-Day Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A month calendar where the admin marks/unmarks meeting days and bulk-marks recurring patterns; marking a day snapshots the active requirement templates into `meeting_requirements`.

**Architecture:** New Hono route group `meeting-days` on the Worker. A shared `snapshotRequirements()` helper copies active templates into `meeting_requirements` at mark time (history is frozen against later template edits). Frontend gets a dependency-free month-grid Calendar visible to all signed-in users, with admin-only marking controls and a bulk recurring form. RAG status coloring is deferred (compliance engine is Phase 5); Phase 3 shows a neutral meeting marker.

**Tech Stack:** Hono, D1, React + Vite, Vitest, better-sqlite3 (test shim, reused from Phase 2).

## Data/contract notes
- Dates are ISO `YYYY-MM-DD`. Weekday computed via `new Date(`${date}T00:00:00Z`).getUTCDay()` (0=Sun..6=Sat) to avoid local-timezone drift.
- `meeting_days.date` is UNIQUE: marking an existing day is a 409 (single) or silently skipped (bulk).
- Unmark deletes the day's `meeting_requirements` first, then the day.

---

## File Structure
```
worker/src/snapshot.ts                # snapshotRequirements(db, meetingDayId)
worker/src/routes/meetingDays.ts      # list/get/mark/unmark/bulk
worker/src/index.ts                   # mount /api/meeting-days (UPDATE)
worker/test/meetingDays.test.ts       # snapshot + mark/unmark/bulk/list
frontend/src/calendar/CalendarView.tsx # month grid, navigation, marking, bulk form
frontend/src/App.tsx                  # add Calendar tab for all users (UPDATE)
```

---

## Task 1: Snapshot helper + mark/unmark (TDD)

**Files:** `worker/src/snapshot.ts`, `worker/src/routes/meetingDays.ts`, test `worker/test/meetingDays.test.ts`

- [ ] **Write failing test** `worker/test/meetingDays.test.ts`:
  - admin POST `/api/meeting-days` `{date:"2026-07-07"}` -> 201; GET `/api/meeting-days/:id` returns the day with **9** snapshotted requirements (all active templates), each `status:"missing"`.
  - re-marking the same date -> 409.
  - member POST -> 403.
  - editing a template after marking does NOT change the snapshotted rows (mark, deactivate a template via direct DB, re-fetch day -> still 9).
  - admin DELETE `/api/meeting-days/:id` -> removes day and its requirements (GET -> 404).
- [ ] **Implement `snapshot.ts`:**
  ```ts
  import type { Env } from "./bindings";
  export async function snapshotRequirements(env: Env, meetingDayId: string): Promise<number> {
    const { results } = await env.DB.prepare(
      "SELECT id, label, compulsory, expected_kind FROM requirement_templates WHERE active=1 ORDER BY sort_order"
    ).all<{ id: string; label: string; compulsory: number; expected_kind: string | null }>();
    for (const t of results) {
      await env.DB.prepare(
        "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status) VALUES (?, ?, ?, ?, ?, ?, 'missing')"
      ).bind(crypto.randomUUID(), meetingDayId, t.id, t.label, t.compulsory, t.expected_kind).run();
    }
    return results.length;
  }
  ```
- [ ] **Implement `routes/meetingDays.ts`** with GET `/`, GET `/:id`, POST `/` (requireAdmin, insert day + snapshot, 409 if date exists), DELETE `/:id` (requireAdmin, delete requirements then day). Use `c.get("user").email` for `created_by`.
- [ ] Mount `app.route("/api/meeting-days", meetingDays)` in `index.ts`.
- [ ] Tests pass. Commit.

## Task 2: Bulk recurring mark (TDD)

- [ ] **Add failing tests:** admin POST `/api/meeting-days/bulk` `{start:"2026-07-01", end:"2026-07-31", weekdays:[2,4]}` (Tue+Thu) -> `{created: N, skipped: 0}` where N = count of Tue/Thu in July 2026; each created day has 9 requirements; re-running same bulk -> `{created:0, skipped:N}`. Member -> 403. Empty/invalid weekdays -> 400.
- [ ] **Implement** `POST /api/meeting-days/bulk` (requireAdmin): iterate UTC dates start..end inclusive, keep those whose `getUTCDay()` is in `weekdays` and not already marked, insert + snapshot each; return counts. Register BEFORE `/:id`-style routes are not an issue (distinct path).
- [ ] Tests pass. Commit.

## Task 3: Frontend calendar

- [ ] `frontend/src/calendar/CalendarView.tsx`: month grid built with plain JS (no date lib). Props: none; manages `monthCursor` state. Fetches `/api/meeting-days?from=<firstVisible>&to=<lastVisible>` via `api()`. Renders 7-col grid, highlights meeting days. If `isAdmin` (from `useAuth`): clicking an unmarked day marks it (POST), clicking a marked day offers unmark (DELETE + confirm); a "Bulk mark" form (weekday checkboxes Sun..Sat + start/end date) posts to `/bulk`. Non-admins see the same grid read-only.
- [ ] `frontend/src/App.tsx`: add a **Calendar** tab available to everyone; default tab = Calendar. Members now see the calendar instead of the placeholder; admin tabs become Calendar / Members / Requirements.
- [ ] Typecheck + build. Commit.

## Task 4: Verification gate
- [ ] `npm test` (Phase 1+2+3 worker tests green).
- [ ] `npm run typecheck` clean (3 workspaces).
- [ ] `npm run build` frontend.
- [ ] `wrangler deploy --dry-run` bundles.
- [ ] Final commit.

## Self-Review
- Mark/unmark -> Task 1. Bulk recurring -> Task 2. Snapshot-at-mark + history-frozen -> Task 1 (snapshot.ts, dedicated test). Month calendar + admin controls -> Task 3. Deferred (noted): RAG coloring (Phase 5/6), meeting-day detail/submissions (Phase 4).
- Type consistency: `meeting_requirements` columns (`template_id`, `label`, `compulsory`, `expected_kind`, `status`) match Phase 1 schema; snapshot inserts all of them. `created_by` = admin email. Endpoint shapes documented for the Phase-? frontend to match.
