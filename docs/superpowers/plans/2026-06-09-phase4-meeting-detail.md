# Phase 4: Meeting-Day Detail (attendance, submissions, media) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** A meeting-day detail view where members record attendance, add text submissions (accomplishments, build needs, goals, failures, notes), and upload media to R2 against the day's requirement checklist, with live submitted/missing status and a "what's still missing" banner.

**Architecture:** Day-scoped sub-resources added to the `meeting-days` router (attendance, submissions, media create+list). Item-level ops get small top-level routers (`/api/submissions/:id`, `/api/media/:id`). Media bytes go to R2 (`env.MEDIA`); reads stream back through an authed worker endpoint (simpler than presigning on the binding). Per-requirement status is DERIVED on read in the detail endpoint (caching + day-level RAG is Phase 5). These are MEMBER actions (requireUser), not admin-only.

**Tech Stack:** Hono, D1, R2, React + Vite, Vitest, better-sqlite3 + in-memory R2 stub (tests).

## Access model
- Attendance, submissions, media create/list/delete: any signed-in user (`requireUser`). Members do the documenting.
- Unmarking a day stays admin-only (Phase 3).

## Status derivation (subset of PRD 6.1, applied to one day)
- attendance requirement: satisfied if at least one attendance row with present=1.
- other requirement R: satisfied if a submission or media row has `requirement_id = R.id`; else kind-fallback for unassigned items (media requirement <- any media with null requirement_id; text requirement <- any submission with null requirement_id and a text kind; any <- any submission/media).
- missingCompulsory = compulsory requirements not satisfied.

---

## File Structure
```
worker/migrations/0003_media_content_type.sql   # ALTER media ADD content_type
worker/src/status.ts                             # deriveRequirementStatus()
worker/src/routes/meetingDays.ts                 # + /:id/attendance, /:id/submissions, /:id/media (UPDATE)
worker/src/routes/submissions.ts                 # DELETE /api/submissions/:id
worker/src/routes/media.ts                       # GET /:id/file, DELETE /:id
worker/src/index.ts                              # mount submissions + media (UPDATE)
worker/test/helpers/d1.ts                        # apply 0003 + makeR2Stub() (UPDATE)
worker/test/dayDetail.test.ts                    # attendance/submissions/media + derived status
types/src/index.ts                               # Media.content_type (UPDATE)
frontend/src/calendar/MeetingDayDetail.tsx       # the detail screen
frontend/src/calendar/CalendarView.tsx           # click marked day -> open detail (UPDATE)
```

---

## Task 1: migration + types + test harness updates
- [ ] `0003_media_content_type.sql`: `ALTER TABLE media ADD COLUMN content_type TEXT;`
- [ ] `types/src/index.ts`: add `content_type: string | null;` to `Media`.
- [ ] `worker/test/helpers/d1.ts`: apply `0003` in `makeTestDb()`; add `makeR2Stub()` (in-memory put/get/delete) and include `MEDIA` in `testEnv`.
- [ ] Commit.

## Task 2: status helper + derived detail (TDD)
- [ ] `worker/test/dayDetail.test.ts` (fails first): mark a day (6 compulsory missing). Assert `missingCompulsory` length 6.
- [ ] `worker/src/status.ts`: `deriveRequirementStatus(reqs, { presentCount, submissions, media })` -> `{ requirements: (req & {status})[], missingCompulsory }`.
- [ ] Update `GET /api/meeting-days/:id` to load attendance present count + submissions + media and return derived `requirements` + `missingCompulsory`.
- [ ] Tests pass. Commit.

## Task 3: attendance (TDD)
- [ ] Tests: GET `/:id/attendance` returns active roster with present=0 default; POST `{member_id, present:1}` upserts; after marking one present, detail's attendance requirement is satisfied and missingCompulsory drops by 1.
- [ ] Implement GET (LEFT JOIN roster) + POST upsert in `meetingDays.ts`.
- [ ] Tests pass. Commit.

## Task 4: submissions (TDD)
- [ ] Tests: POST `/:id/submissions` `{kind:"accomplishment", content, requirement_id:"<the day's accomplishments req id>"}` -> 201; detail shows that requirement satisfied; GET list returns it; DELETE `/api/submissions/:id` by author -> 200, by other member -> 403.
- [ ] Implement POST/GET in `meetingDays.ts`; `submissions.ts` for DELETE (author or admin). `created_at = new Date().toISOString()`, `created_by = user.email`.
- [ ] Tests pass. Commit.

## Task 5: media to R2 (TDD)
- [ ] Tests (with R2 stub): POST `/:id/media` multipart {file, caption, kind, requirement_id} -> 201 row with r2_key; the stub holds the key; GET `/:id/media` lists it; GET `/api/media/:id/file` -> 200 with the original bytes; media requirement satisfied; DELETE removes row + R2 object.
- [ ] Implement POST (parseBody -> File -> `env.MEDIA.put(key, await file.arrayBuffer())` + row with content_type) and GET list in `meetingDays.ts`; `media.ts` for `GET /:id/file` (stream from R2) and `DELETE /:id` (uploader or admin).
- [ ] Mount submissions + media routers in `index.ts`.
- [ ] Tests pass. Commit.

## Task 6: frontend detail screen
- [ ] `MeetingDayDetail.tsx`: fetch detail + attendance + submissions + media. Render: "what's still missing" banner (missingCompulsory labels), requirement checklist with per-kind inline controls (attendance -> roster present toggles; text -> textarea+add tied to requirement_id; media -> file+caption+subsystem upload tied to requirement_id), and lists of existing submissions/media (media link to `/api/media/:id/file`). Admin gets "Unmark this day".
- [ ] `CalendarView.tsx`: clicking a MARKED day opens the detail (selectedDayId state); clicking an UNMARKED day (admin) marks it; unmark moves into the detail.
- [ ] Typecheck + build. Commit.

## Task 7: verification gate
- [ ] `npm test` (all worker tests), `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. Commit. Note: run `wrangler d1 migrations apply weeklog --local` (and `--remote` for prod) to pick up 0003.

## Self-Review
- Attendance + submissions + media upload to R2 -> Tasks 3,4,5. Requirement checklist with live status + missing banner -> Task 2 + frontend Task 6. Member (not admin) does documenting -> requireUser. Deferred (noted): status caching + day-level RAG + dashboard (Phase 5/6).
- Type consistency: `Media.content_type` added to schema (0003), shared type, insert, and serve. Submission `kind` values match PRD enum. requirement_id ties drive derivation.
