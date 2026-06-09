# Per-Meeting Editable Requirements — Design

**Date:** 2026-06-10
**Status:** Approved, pending implementation plan

## Problem

Every meeting is created by snapshotting all active requirement templates into
`meeting_requirements`, with each row carrying its own `compulsory` flag. That
per-meeting copy is currently frozen. Admins need to deviate a single meeting's
requirements from the default template set **after** the meeting is created —
without affecting the global templates or any other meeting.

## Scope

Admin-only. Editing happens **after creation**, from the meeting detail page.
Supported deviations for one meeting:

1. Toggle a requirement compulsory ↔ voluntary.
2. Remove a requirement that does not apply to this meeting.
3. Add back a default (template) requirement not currently on the meeting.
4. Add a custom one-off requirement that is not in the templates at all.

Out of scope: choosing overrides at creation time; editing global templates
(already handled by `TemplatesAdmin`); editing the label/type of an existing
template-backed requirement (custom add covers bespoke needs).

## Approach

`meeting_requirements` is already the per-meeting copy, so we make those rows
editable in place rather than introducing a separate overrides table. RAG status
recomputes for free because `dayStatus.ts` / `status.ts` already read
`compulsory` off these rows.

**Remove is a soft-delete** (`active = 0`): the requirement leaves the checklist
and the RAG count, but any media/submissions already linked to it stay in the
database untouched, and the removal is reversible.

## Data Model

New migration `worker/migrations/0006_meeting_requirements_editable.sql`:

- Add `active INTEGER NOT NULL DEFAULT 1` to `meeting_requirements` (soft-remove).
- Add `custom INTEGER NOT NULL DEFAULT 0` to flag one-off requirements that are
  not template-backed (`template_id` is already nullable).

All reads of `meeting_requirements` must filter `WHERE active = 1`. Known read
sites to update:

- `worker/src/routes/meetingDays.ts` — `GET /api/meeting-days/:id` detail.
- `worker/src/dayStatus.ts` — RAG aggregation (counts compulsory).
- `worker/src/status.ts` — per-requirement submitted/missing derivation.
- ZIP export read in `meetingDays.ts` (`GET /api/meeting-days/:id/zip`).

## Worker API

All routes admin-gated via the existing `requireAdmin` middleware, mounted in
`worker/src/routes/meetingDays.ts`.

| Method | Path | Body | Behavior |
|--------|------|------|----------|
| PATCH  | `/api/meeting-days/:id/requirements/:reqId` | `{ compulsory: 0\|1 }` | Flip compulsory for that one requirement. |
| DELETE | `/api/meeting-days/:id/requirements/:reqId` | — | Soft-remove: set `active = 0`. |
| POST   | `/api/meeting-days/:id/requirements` | `{ templateId }` **or** `{ label, compulsory, expectedKind }` | Add a requirement (see below). |
| GET    | `/api/meeting-days/:id/requirements/available` | — | List active templates not currently on this meeting (for the "add default" picker). |

**POST add semantics:**

- `{ templateId }` (re-add a default):
  - If a soft-removed row for that `template_id` exists on this meeting →
    reactivate it (`active = 1`). Preserves any previously linked data.
  - Else → snapshot a fresh row from the template (`label`, `compulsory`,
    `expected_kind` copied; `status = 'missing'`, `custom = 0`).
- `{ label, compulsory, expectedKind }` (custom one-off):
  - Insert a new row with `template_id = NULL`, `custom = 1`,
    `status = 'missing'`. `expectedKind` ∈ `attendance|text|media|any`.

**Validation / edge cases:**

- `:reqId` must belong to `:id` (404 otherwise).
- Reject toggling/removing an already-removed row (404 / no-op).
- `available` excludes templates that have an `active = 1` row on the meeting;
  a soft-removed template still appears (re-adding reactivates it).
- Custom add validates `expectedKind` against the allowed set.

## Frontend

Wiring stays in the `src/lib` seam; components stay presentational.

**`frontend/src/lib/hooks/useMeetingDay.ts`** — new mutations:
`toggleCompulsory(reqId, next)`, `removeRequirement(reqId)`,
`addRequirement(payload)`, plus a loader for `requirements/available`. Each
refreshes the meeting detail on success.

**`frontend/src/lib/hooks/types.ts`** — extend the `Requirement` interface with
`custom` (and keep `active` server-side only / always-true client-side).

**`frontend/src/calendar/MeetingDayDetail.tsx`** (admin only):

- Each `RequirementCard` gains a compulsory ↔ voluntary toggle and a remove (×)
  control, styled to match the existing inline-styled cards and RAG colors.
- Below the checklist, an "Add requirement" control with two paths:
  1. Pick an unused template from the `available` list.
  2. Fill a small custom form: label, type (`attendance|text|media|any`),
     compulsory checkbox.
- Non-admin users see the checklist exactly as today (no edit affordances).

## Testing

Worker route tests (Vitest, matching existing `worker` test style):

- Toggle compulsory → `dayStatus` RAG reflects the change.
- Remove → requirement drops from detail and from compulsory count; linked
  media/submissions remain in the DB.
- Re-add by `templateId`: reactivates a soft-removed row (data preserved) vs.
  fresh-snapshots when none exists.
- Custom add persists with `custom = 1`, `template_id = NULL`.
- `available` excludes active template rows, includes soft-removed ones.
- All four mutating routes reject non-admin callers.

## Files Touched

- `worker/migrations/0006_meeting_requirements_editable.sql` (new)
- `worker/src/routes/meetingDays.ts` (new routes + `active=1` filters)
- `worker/src/snapshot.ts` (reuse helper for fresh template snapshot, if shared)
- `worker/src/dayStatus.ts`, `worker/src/status.ts` (`active=1` filter)
- `worker/test/*` (new route tests)
- `frontend/src/lib/hooks/useMeetingDay.ts`, `frontend/src/lib/hooks/types.ts`
- `frontend/src/calendar/MeetingDayDetail.tsx`
