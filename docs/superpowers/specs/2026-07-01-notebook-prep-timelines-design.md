# Notebook Prep, Slice B: Subsystem Timelines + Publish/Request Flow

Date: 2026-07-01
Status: Approved for planning
Source PRD: `PRD'S/PRD_notebook_prep.md`
Reference brief: `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`

## 1. Purpose and scope

This is the first buildable slice of the Notebook Prep pipeline. It delivers the first
independently useful, user-visible win: the team opens WeekLog and sees a per-subsystem
chronological arc of their logged season, plus the publish and request machinery that every
later report kind (gaps, decisions, scaffold) will reuse.

In scope:
1. Shared JSON contract in the `types/` workspace.
2. A `notebook_reports` table (one current row per kind, latest wins) and a `notebook_requests`
   table (teammate refresh requests awaiting admin action).
3. Worker routes under `/api/notebook`: read reports, create/list requests, and an admin-only
   `generate/timeline` that computes the timeline snapshot from live D1 data.
4. A new Notebook Prep frontend view with a working Timeline tab, its own visual style, plus the
   admin Generate button and teammate Request-refresh flow.

Out of scope for this slice (deferred, seams left):
- Coverage stats, gap analysis, decision extraction, scaffold assembly (later slices).
- A `season.json` export file. Because the Worker computes the timeline directly from D1 (see
  section 4), the intermediate file is not needed yet. It gets built when the offline Claude Code
  reasoning phases need it. Revisit if a full season dump becomes useful sooner.

## 2. Runtime model recap (why the shape is what it is)

The Notebook Prep pipeline has no runtime LLM API and no ongoing cost. Deterministic reports (this
slice's timeline) are computed by the Worker on an admin trigger. The later reasoning reports are
authored offline by Claude Code and published through the same write-back path. The view never
cares how a report row was produced; it renders whatever is published. That is why the read path
is uniform (snapshot per kind) even though the produce path differs by kind.

Chosen interaction model (from brainstorm):
- Uniform publish/snapshot: the view reads the latest published snapshot per kind, not a live
  computation.
- Option 2 produce path for deterministic reports: an in-app admin Generate button computes and
  stores the snapshot.
- Teammate refresh requests: any member can request a refresh of a kind; the request sits pending
  and awaits the admin (`vibha.aarav@gmail.com`, the configured `ADMIN_EMAIL`) running Generate.

## 3. Shared types (`types/` workspace)

Defined once in `@weeklog/types` and imported by both the worker and the frontend so the contract
cannot drift.

```ts
export type ReportKind = 'timeline' | 'gaps' | 'decisions' | 'scaffold';

export type NotebookReport = {
  id: string;
  kind: ReportKind;
  generated_at: string; // ISO
  payload: TimelinePayload; // union widens as later kinds land
};

// Photos are date-keyed, not attributed to a submission: media carries no subsystem tag
// (media.subsystem is null in production), so attaching a photo to one subsystem would misfile it.
export type TimelinePayload = {
  subsystems: Array<{
    name: string; // "Shooter", "Drivetrain/Collector", "Uncategorized", ...
    entries: Array<{
      date: string;
      kind: 'accomplishment' | 'failure' | 'build_need' | 'goal' | 'note';
      text: string;               // the team's own logged words, verbatim
      created_by: string | null;
    }>;
  }>;
  photosByDate: Array<{
    date: string;
    photos: Array<{ caption: string; kind: string }>; // metadata only, no bytes
  }>;
};

export type ReportRequestStatus = 'pending' | 'fulfilled';
export type ReportRequest = {
  id: string;
  kind: ReportKind;
  requested_by: string;   // email or "" for anonymous member
  requested_at: string;   // ISO
  status: ReportRequestStatus;
  fulfilled_at: string | null;
};
```

Hard rule on payload content: `text` is the team's own words, verbatim, never rewritten. This slice
produces no prompts or generated prose; those arrive with the reasoning phases.

## 4. Data model (migration `0008_notebook.sql`)

```sql
CREATE TABLE notebook_reports (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL UNIQUE,   -- one current row per kind, latest wins
  generated_at TEXT NOT NULL,
  payload      TEXT NOT NULL           -- JSON string of the typed payload
);

CREATE TABLE notebook_requests (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  requested_by TEXT,
  requested_at TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  fulfilled_at TEXT
);
CREATE INDEX idx_notebook_requests_kind_status ON notebook_requests(kind, status);
```

## 5. Worker routes (`/api/notebook`, mounted in `worker/src/index.ts`)

- `GET /reports` (requireUser): returns the latest report per kind as a map, so the view renders in
  one round trip. Missing kinds are absent.
- `GET /requests` (requireUser): returns pending requests grouped by kind (counts, plus latest
  requested_at) for the admin indicator.
- `POST /requests` (requireUser): body `{ kind }`. Creates a pending request. `requested_by` is the
  signed-in email or "" for an anonymous member.
- `POST /generate/timeline` (requireAdmin): computes `TimelinePayload` from live D1, upserts the
  `timeline` row in `notebook_reports` with `generated_at = now`, and marks all pending `timeline`
  requests fulfilled in the same operation. Returns the fresh payload.
- Deferred seam (not built now): `POST /publish` (requireAdmin) accepts an externally authored
  `NotebookReport` and upserts by kind. The reasoning phases publish through this. Same table, no
  schema change.

### 5.1 Timeline computation

Query and assemble deterministically:
- Canonical subsystem list and order from the `committees` table (`sort_order`). This is the team's
  real taxonomy, and `submissions.subsystem` already uses these exact names.
- For each subsystem, `entries` are that subsystem's submissions (`kind`, `content` as `text`,
  `created_by`, `created_at` date), ordered by date.
- Submissions with a null subsystem go to an `Uncategorized` bucket. Any stray subsystem value not
  matching a committee still renders (defensive), appended after the canonical list.
- `photosByDate`: meeting-day media (`caption`, `kind`) grouped by the owning meeting day's date.
  Deadline media is not part of the subsystem timeline. No image bytes are read.

Empty subsystems (no entries) are omitted so the picker only lists subsystems with content.

## 6. Frontend: Notebook Prep view

A new route with its own visual style, distinct from the compliance dashboard, but still legible at
a glance. Access follows WeekLog auth: all members view; only admin generates.

- Persistent banner on the whole view: "Draft raw material and audit for the team's engineering
  notebook. Not a notebook. The team writes the notebook."
- Tabs: Timeline (built) plus Gaps, Decisions, Scaffold shown as visible-but-disabled "Coming soon"
  (revisitable: could hide entirely). Disabled tabs have no request buttons.
- Timeline tab:
  - Subsystem picker from `payload.subsystems`.
  - Selected subsystem renders as a dated vertical arc. Each entry shows its date, a color-by-kind
    chip, the verbatim text, and the contributor. Kind colors: accomplishment green, failure red,
    build_need amber, goal blue, note neutral. Legible as strong / attention / neutral without
    instruction.
  - Per-date "meeting photos" rows drawn from `photosByDate`, interleaved by date, caption shown.
- Controls:
  - Admin (you): "Generate / refresh timelines" button, plus an "N refresh requested" indicator
    when pending timeline requests exist.
  - Members: "Request refresh" button and a "last updated <date>" line from the report's
    `generated_at`.
- A `useNotebook()` hook owns reads (`/reports`, `/requests`) and the generate/request actions,
  mirroring the existing hook patterns. Network access stays in the protected `api` wiring.

## 7. Testing

Worker (vitest, existing D1/R2 test harness):
- `generate/timeline` computes the expected payload from seeded meeting days, submissions across
  several subsystems (including a null-subsystem entry landing in Uncategorized), and meeting-day
  media grouped into `photosByDate`.
- Generate upserts one row per kind (a second generate replaces, not duplicates) and flips pending
  `timeline` requests to fulfilled.
- Requests: create then list returns the pending request; auth gating verified (generate is
  admin-only and returns 403 for a non-admin member; request creation works for any member).

Frontend: a light render test of the Timeline tab from a fixture `TimelinePayload` (subsystem
picker lists non-empty subsystems, entries render with kind chips, a per-date photo row appears).

## 8. Guardrails honored

- No runtime LLM API calls. The timeline is deterministic Worker compute.
- No image bytes reach any step; photos travel as metadata only.
- Admin-gated publish; the report is a snapshot awaiting admin Generate.
- The "not a notebook" banner is always present.
- No em dashes anywhere in code, UI copy, or docs.

## 9. Build order within this slice

1. Shared types in `types/`.
2. Migration `0008_notebook.sql` plus the two tables.
3. Worker `/api/notebook` routes, with `generate/timeline` computing from D1, and tests.
4. Notebook Prep view with the Timeline tab, admin Generate, and teammate Request-refresh.
5. Wire the nav entry and the persistent banner.

## 10. Deferred seams

- `POST /publish` write-back for offline-authored reports.
- `season.json` export for the offline reasoning phases.
- Coverage, gaps, decisions, scaffold tabs and their payload types.
- Tagging media with a subsystem at upload time (would let photos attach to subsystem arcs later).
