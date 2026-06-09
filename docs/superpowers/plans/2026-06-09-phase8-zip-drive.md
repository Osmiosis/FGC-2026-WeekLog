# Phase 8: ZIP Export + Stubbed Drive Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Let users download a meeting day as a ZIP (media + a Markdown/JSON summary) and download all media in bulk, and define a `DriveConnector` seam (default `NullDriveConnector`) so a real Drive sync can be added later with no UI/core changes. No live Drive writes in v1 (PRD Section 8).

**Architecture:** `fflate` (pure-JS, Workers-compatible) builds ZIPs in the Worker from R2 bytes + a generated summary. A `summary.ts` assembles a day's structured + Markdown summary (reusing the Phase 5 engine). `drive.ts` defines the interface, the no-op default, and `getDriveConnector(env)` selected by an (optional) `DRIVE_ENABLED` flag, with a documented TODO for `R2ToDriveConnector`. Authed downloads reach the browser via a blob helper.

**Tech Stack:** Hono, D1, R2, fflate, React + Vite, Vitest.

---

## File Structure
```
worker/package.json                 # + fflate (UPDATE)
worker/src/bindings.ts              # optional DRIVE_ENABLED / DRIVE_FOLDER_ID (UPDATE)
worker/src/summary.ts               # buildDaySummary(env, dayId) -> {json, markdown, mediaRows}
worker/src/drive.ts                 # DriveConnector, NullDriveConnector, getDriveConnector + TODO
worker/src/routes/meetingDays.ts    # GET /:id/zip (UPDATE)
worker/src/routes/exports.ts        # GET /all-media/zip  (mounted /api/export)
worker/src/routes/drive.ts          # GET /status, POST /push/:dayId (mounted /api/drive)
worker/src/index.ts                 # mount exports + drive (UPDATE)
worker/test/zip.test.ts             # day zip + bulk zip + drive seam
frontend/src/api.ts                 # downloadAuthed() (UPDATE)
frontend/src/calendar/MeetingDayDetail.tsx  # "Download day (ZIP)" (UPDATE)
frontend/src/dashboard/Dashboard.tsx        # export + Drive-not-configured note (UPDATE)
```

---

## Task 1: summary + drive seam + zip routes (TDD)
- [ ] `worker/test/zip.test.ts` (fails first): mark a day, add a text submission + a media file; `GET /api/meeting-days/:id/zip` -> 200, `application/zip`; unzip (fflate) contains `summary.md`, `summary.json`, and the media bytes under `media/`. `GET /api/export/all-media/zip` contains the media. `GET /api/drive/status` -> `{ configured: false }`. `POST /api/drive/push/:dayId` -> `{ configured: false }` (no-op).
- [ ] Add `fflate` to `worker/package.json`; `npm install`.
- [ ] `summary.ts`: load day + derived requirements + present roster + submissions + media; return `{ json, markdown, mediaRows }`.
- [ ] `drive.ts`: `DriveConnector` interface, `NullDriveConnector` (isConfigured=false, pushDayMedia no-op), `getDriveConnector(env)` (returns Null unless `DRIVE_ENABLED==='1'`, with a TODO for `R2ToDriveConnector`).
- [ ] `meetingDays.ts`: `GET /:id/zip` builds the zip via `zipSync`. `routes/exports.ts`: `GET /all-media/zip`. `routes/drive.ts`: status + push (delegates to connector).
- [ ] Mount in `index.ts`. Tests pass. Commit.

## Task 2: frontend export controls
- [ ] `api.ts`: `downloadAuthed(path, filename)` (fetch with bearer -> blob -> trigger download).
- [ ] `MeetingDayDetail.tsx`: "Download day (ZIP)" button.
- [ ] `Dashboard.tsx`: an "Export and backup" section with "Download all media (ZIP)" and a Drive-status line ("Drive sync: not configured. Download a ZIP and upload to the mentors' Drive manually.").
- [ ] Typecheck + build. Commit.

## Task 3: verification gate
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. Commit.

## Self-Review
- Download day as ZIP (media + summary) + bulk media ZIP -> Tasks 1,2. DriveConnector interface + NullDriveConnector default + config flag + TODO, no live writes -> Task 1. Deferred to Phase 9: README/seeds/free-tier pass.
- Type consistency: connector interface matches PRD `{ isConfigured(): boolean; pushDayMedia(dayId): Promise<...> }`; zip served as `application/zip`; downloads use the existing authed-blob pattern.
