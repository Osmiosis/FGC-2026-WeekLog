# Phase 6: Dashboard + Deadlines Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** The landing dashboard (PRD 6.4): big team-wide red/amber/green, "needs attention" list, this-week strip, upcoming deadlines; plus the deadlines tracker (PRD 6.5): create/edit/delete (admin), mark done + attach proof media (members).

**Architecture:** A `deadlines` route group (CRUD + done/reopen + proof media to R2, reusing the Phase 4 media pattern with `deadline_id`). A `dashboard` route aggregates day statuses (Phase 5 engine, derived live) and deadline statuses into one summary payload. Frontend gets a Dashboard tab (new default landing) and a Deadlines tab; the dashboard's "needs attention" items deep-link into the calendar day detail or the deadlines tab via lightweight nav state lifted to App.

**Tech Stack:** Hono, D1, R2, React + Vite, Vitest.

## Dashboard payload
```
{ today, overall: Rag,
  counts: { daysFlagged, deadlinesOverdue, deadlinesDueSoon },
  needsAttention: [{ type:'day'|'deadline', id, date|due_date, label }],
  thisWeek: [{ id, date, status }],            // Sun..Sat week containing today
  upcomingDeadlines: [{ id, title, due_date, status, daysUntil }] }  // not done, sorted
```
overall = red if any red day/deadline; else amber if any amber; else green.

---

## File Structure
```
worker/src/compliance.ts            # + addDaysUTC() (UPDATE)
worker/src/routes/deadlines.ts      # CRUD + done/reopen + proof media
worker/src/routes/dashboard.ts      # GET / summary
worker/src/index.ts                 # mount /api/deadlines, /api/dashboard (UPDATE)
worker/test/deadlines.test.ts
worker/test/dashboard.test.ts
frontend/src/dashboard/Dashboard.tsx
frontend/src/deadlines/DeadlinesView.tsx
frontend/src/calendar/CalendarView.tsx  # accept initialOpenDayId prop (UPDATE)
frontend/src/App.tsx                # Dashboard default + Deadlines tab + nav state (UPDATE)
```

---

## Task 1: deadlines API (TDD)
- [ ] `worker/test/deadlines.test.ts` (fails first): GET list returns seeded deadline with a `status` field; admin POST creates (member 403); member `POST /:id/done` sets status done + completed_at; admin PATCH edits; admin DELETE removes; member uploads proof media (`POST /:id/media`) -> media row with deadline_id, listed by `GET /:id/media`. Use relative due dates (`addDaysUTC(today, n)`) to assert overdue->red, soon->amber, far->green.
- [ ] Implement `addDaysUTC` in `compliance.ts`.
- [ ] Implement `routes/deadlines.ts`: GET (list + deadlineRag), POST (admin), PATCH (admin), DELETE (admin), POST `/:id/done` (requireUser), POST `/:id/reopen` (admin), POST `/:id/media` (requireUser, R2), GET `/:id/media`.
- [ ] Mount in `index.ts`. Tests pass. Commit.

## Task 2: dashboard API (TDD)
- [ ] `worker/test/dashboard.test.ts` (fails first): empty -> overall green; a past empty meeting day -> overall red, counts.daysFlagged=1, needsAttention has the day; an overdue deadline -> needsAttention has it, deadlinesOverdue=1; a day in the current week appears in thisWeek; an open future deadline appears in upcomingDeadlines with daysUntil.
- [ ] Implement `routes/dashboard.ts`: load all meeting days (derive status live via Phase 5 helpers), all deadlines (deadlineRag), bucket into overall/counts/needsAttention/thisWeek/upcomingDeadlines.
- [ ] Mount. Tests pass. Commit.

## Task 3: frontend dashboard + deadlines
- [ ] `Dashboard.tsx`: big overall RAG banner + counts; needs-attention list (day items call `onOpenDay(id)`, deadline items call `onGoToDeadlines()`); this-week strip (colored chips); upcoming deadlines with countdown.
- [ ] `DeadlinesView.tsx`: list with status badges; admin create/edit/delete form; member "Mark done" + proof upload (FormData) + view proof thumbnails.
- [ ] `CalendarView.tsx`: accept optional `initialOpenDayId` and open it.
- [ ] `App.tsx`: tabs Dashboard (default) / Calendar / Deadlines for all; Members / Requirements for admin. Lift `openDay(id)` and `goToDeadlines()` nav helpers.
- [ ] Typecheck + build. Commit.

## Task 4: verification gate
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. Commit.

## Self-Review
- Dashboard 6.4 (overall RAG, needs attention, this week, upcoming) -> Tasks 2,3. Deadlines tracker 6.5 (admin CRUD, member done + proof) -> Tasks 1,3. Reuses Phase 5 engine + Phase 4 media/R2. Deferred to Phase 7: browse/search + open build needs.
- Type consistency: `Rag` shared; deadline fields match schema (`due_date`, `status`, `category`, `completed_at`, `link`); media reuses `deadline_id` + `/api/media/:id/file`.
