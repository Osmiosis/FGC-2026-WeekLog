# Phase 7: Browse / Search + Open Build Needs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Search across submissions (content, with subsystem / kind / date-range / compliance-status filters) and a dedicated "Open Build Needs" view aggregating unresolved build_need submissions, with a resolve toggle.

**Architecture:** A `resolved` flag on submissions (migration 0004) drives the build-needs view. A `search` route filters submissions joined to their meeting day (for date + status). A `build-needs` route lists open (or all) build needs. Resolve/unresolve live on the submissions router. Frontend gets a Browse tab: an open-build-needs panel plus a filtered search.

**Tech Stack:** Hono, D1, React + Vite, Vitest.

---

## File Structure
```
worker/migrations/0004_submission_resolved.sql  # ALTER submissions ADD resolved
types/src/index.ts                               # Submission.resolved (UPDATE)
worker/test/helpers/d1.ts                        # apply 0004 (UPDATE)
worker/src/routes/search.ts                      # `search` + `buildNeeds` routers
worker/src/routes/submissions.ts                 # + resolve / unresolve (UPDATE)
worker/src/index.ts                              # mount /api/search, /api/build-needs (UPDATE)
worker/test/search.test.ts
frontend/src/browse/BrowseView.tsx
frontend/src/App.tsx                             # Browse tab (UPDATE)
```

---

## Task 1: migration + types + harness
- [ ] `0004_submission_resolved.sql`: `ALTER TABLE submissions ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;`
- [ ] `types`: add `resolved: number;` to `Submission`.
- [ ] `helpers/d1.ts`: apply 0004 in `makeTestDb()`.
- [ ] Commit.

## Task 2: search + build-needs + resolve (TDD)
- [ ] `worker/test/search.test.ts` (fails first): mark a day; add an accomplishment ("Drivetrain works") and a build_need ("Need bolts", subsystem Shooter). Then:
  - `GET /api/search?q=bolts` returns the build_need.
  - `?subsystem=Shooter` filters to Shooter.
  - `?kind=build_need` returns only build needs.
  - `?from=&to=` date range filters by the day's date.
  - `GET /api/build-needs?open=1` includes the unresolved need; `POST /api/submissions/:id/resolve` then excludes it from open; `GET /api/build-needs` (all) still shows it with resolved=1.
- [ ] `routes/search.ts`: `search` (dynamic WHERE over content/subsystem/kind/date, optional `status` RAG filter via Phase 5 helpers) and `buildNeeds` (kind='build_need', optional open filter), each joined to meeting_days for `date`.
- [ ] `routes/submissions.ts`: `POST /:id/resolve` and `POST /:id/unresolve` (requireUser).
- [ ] Mount in `index.ts`. Tests pass. Commit.

## Task 3: frontend Browse
- [ ] `BrowseView.tsx`: open-build-needs panel (count + list with Resolve, toggle to show resolved) and a search form (q, subsystem, kind, from, to, status) with results; each result deep-links via `onOpenDay`.
- [ ] `App.tsx`: add a Browse tab for all users.
- [ ] Typecheck + build. Commit.

## Task 4: verification gate
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`; apply 0004 locally. Commit.

## Self-Review
- Search across submissions + filters (subsystem/date/kind/status) -> Task 2,3. Open Build Needs aggregation + resolve flag -> Tasks 1,2,3. Deferred to Phase 8/9: ZIP export + Drive stub, README/seeds/free-tier.
- Type consistency: `Submission.resolved` added to schema (0004) + type; search returns submission rows + `date` from join; resolve endpoints flip the flag the build-needs view reads.
