# Phase 5: Compliance Evaluation Engine + Status Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Implement PRD 6.1: a pure red/amber/green engine for meeting days and deadlines, cache per-requirement status on writes, and surface day-level RAG on the calendar.

**Architecture:** A pure `compliance.ts` (no I/O) holds `dayRag()` and `deadlineRag()` with `today` injected for deterministic tests. `dayStatus.ts` loads a day's live context, derives requirement statuses (reusing Phase 4's `deriveRequirementStatus`), writes them back to `meeting_requirements.status` (the cache, satisfying the caching deliverable), and computes the day RAG. Reads derive live for correctness (tiny scale); the cache is maintained on every mutation. The calendar colors meeting days by RAG.

**Tech Stack:** Hono, D1, React + Vite, Vitest.

## Status rules (PRD 6.1)
- Day: GREEN if all compulsory satisfied (or none compulsory); else RED if the date is in the past; else (today or future, in progress) AMBER. (A past day with no entries is RED via the past-and-incomplete branch.)
- Deadline: GREEN if done; RED if open and past due; AMBER if open and due within 7 days; GREEN if open and further out.
- Date strings are ISO `YYYY-MM-DD`, compared lexicographically (= chronologically). `today` = `new Date().toISOString().slice(0,10)` (UTC; acceptable for v1).

---

## File Structure
```
worker/src/compliance.ts          # pure dayRag(), deadlineRag(), daysBetweenUTC()
worker/src/dayStatus.ts           # deriveDay(), recomputeDayCache(), dayStatusFromDerived()
worker/src/routes/meetingDays.ts  # list + detail return day `status`; mutations recompute cache (UPDATE)
worker/src/routes/submissions.ts  # recompute cache on delete (UPDATE)
worker/src/routes/media.ts        # recompute cache on delete (UPDATE)
worker/test/compliance.test.ts    # pure engine + integration RAG
frontend/src/calendar/CalendarView.tsx  # color days by RAG + legend (UPDATE)
```

---

## Task 1: pure engine (TDD)
- [ ] `worker/test/compliance.test.ts` (fails first): dayRag green when all satisfied (any date); red when past+incomplete; amber when today/future+incomplete; green when compulsoryTotal=0. deadlineRag done->green, overdue->red, due in 3 days->amber, due in 30 days->green.
- [ ] Implement `worker/src/compliance.ts`: `type Rag`, `dayRag()`, `deadlineRag()`, `daysBetweenUTC()`.
- [ ] Tests pass. Commit.

## Task 2: caching + day status wiring (TDD)
- [ ] `worker/src/dayStatus.ts`: `deriveDay(env, dayId)` (load reqs/present/subs/media, derive), `recomputeDayCache(env, dayId)` (derive + UPDATE meeting_requirements.status), `dayStatusFromDerived(date, today, derived)`.
- [ ] `GET /api/meeting-days/:id`: include day `status`; call `recomputeDayCache` so viewing self-heals the cache.
- [ ] `GET /api/meeting-days`: include `status` per day (derive live).
- [ ] Call `recomputeDayCache` after attendance POST, submission POST/DELETE, media POST/DELETE.
- [ ] Integration tests (deterministic via `addDaysUTC(today, n)`): past day no entries -> red; future day -> amber; complete all 6 compulsory on a PAST day -> green (completion overrides past); cached `meeting_requirements.status` flips to 'submitted' after completing.
- [ ] Tests pass. Commit.

## Task 3: calendar coloring
- [ ] `CalendarView.tsx`: color marked day cells by `day.status` (red/amber/green) instead of plain blue; show the meeting label; add a small legend (green = complete, amber = in progress / upcoming, red = past and incomplete).
- [ ] Typecheck + build. Commit.

## Task 4: verification gate
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. Commit.

## Self-Review
- Engine 6.1 (day + deadline RAG) -> Task 1. Status caching (meeting_requirements.status written on writes) -> Task 2. Calendar lights up -> Task 3. Deferred to Phase 6: deadlines tracker UI/CRUD (engine ready), dashboard aggregation.
- Type consistency: `Rag` = 'green'|'amber'|'red' matches shared `types`. Reuses Phase 4 `deriveRequirementStatus`. `today` injected everywhere for determinism.
