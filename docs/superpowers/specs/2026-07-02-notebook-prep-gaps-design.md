# Notebook Prep, Slice C: Gaps + Shared Reasoning/Publish Infrastructure

Date: 2026-07-02
Status: Approved for planning
Source PRD: `PRD'S/PRD_notebook_prep.md`
Reference brief: `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`
Builds on: `docs/superpowers/specs/2026-07-01-notebook-prep-timelines-design.md` (Slice B, shipped)

## 1. Purpose and scope

Slice C adds the first AI-reasoning report (Gaps) and the shared infrastructure every later
reasoning report reuses. Unlike the deterministic Timeline (Worker-computed on an admin click), the
Gaps report is authored offline by Claude Code: it reads the season data plus the FGC reference
brief, reasons about coverage against the award criteria, and publishes a structured `GapPayload`
through a secret-gated write-back route. The Gaps tab renders those findings as RAG cards, the
headline "where is our notebook weak?" screen.

In scope:
1. Two deterministic read endpoints the pipeline consumes: `GET /api/notebook/season` and
   `GET /api/notebook/coverage`.
2. A secret-gated `POST /api/notebook/publish` write-back route (accepts any report kind, so
   Decisions and Scaffold reuse it unchanged).
3. Shared types: `GapPayload`, `CoverageStats`, `SeasonExport`; widen `ReportPayload`.
4. The Gaps tab (RAG cards per criterion) wired into the existing Notebook Prep view.
5. `NOTEBOOK_PREP.md` runbook (Gaps section): the operator procedure Claude Code follows to produce
   and publish the report.

Out of scope (later slices, seams left):
- Decisions tab and `DecisionPayload` (Slice D); Scaffold tab and `ScaffoldPayload` (Slice E). Both
  reuse `/publish` and the read endpoints unchanged.
- Any runtime LLM API. The only AI is Claude Code, run by the operator. Zero ongoing cost.

## 2. Runtime model recap

Deterministic reports (Timeline, and now the Coverage/Season data) are Worker compute. Reasoning
reports (Gaps here) are produced by Claude Code offline and published in. The view reads the latest
published snapshot per kind and does not care how a row was produced. The read endpoints are public
(the logged season is already public in the app); only publish is gated.

## 3. Publish authentication (decided: dedicated secret)

`POST /api/notebook/publish` requires a header `X-Notebook-Secret` whose value matches the Worker
secret `NOTEBOOK_PUBLISH_SECRET`.

- If `NOTEBOOK_PUBLISH_SECRET` is unset on the Worker: the route returns `503 "publish not
  configured"` (the feature ships dormant until the secret is set).
- If the header is missing or does not match: `401 "unauthorized"`.
- On success: upsert the report by kind and fulfil pending requests of that kind.

The secret is a machine credential (no expiry), set once via `wrangler secret put
NOTEBOOK_PUBLISH_SECRET`. Add `NOTEBOOK_PUBLISH_SECRET?: string` to `worker/src/bindings.ts` `Env`.

## 4. Worker routes (added to `worker/src/routes/notebook.ts`)

### 4.1 GET /season (requireUser)
Returns a normalized `SeasonExport`: meeting days, submissions (date, subsystem, kind, content,
created_by), attendance (present member names per meeting date), deadlines, and media metadata only
(caption, kind, date, whether it hangs off a meeting day). No image bytes. This is the raw material
Claude Code reasons over and cites in `evidence_refs`.

### 4.2 GET /coverage (requireUser)
Returns a Worker-computed `CoverageStats`. Objective numbers only, so the reasoning interprets rather
than invents them:
- Per subsystem (canonical list from `committees`, plus `Uncategorized` for null): entry count,
  failure count, build-needs open vs resolved (the `resolved` flag added in migration 0004),
  numeric-entry count (entries whose `content` contains a digit, a quick heuristic for quantified
  decisions).
- Photos: total and counts by `kind`.
- Documentation spread: first and last meeting date, meeting count, and the largest gap in days
  between consecutive meeting dates.
- Totals: submissions, failures, numeric entries.

### 4.3 POST /publish (secret-gated)
Body is a `{ kind, payload }` pair. Validates `kind` is a `ReportKind` and `payload` is present,
then upserts `notebook_reports` by kind (reusing the Slice-B `ON CONFLICT(kind)` upsert) with
`generated_at = now`, and marks pending `notebook_requests` of that kind fulfilled. Accepts any
report kind so Decisions and Scaffold publish through the same route with no change.

## 5. Shared types (`types/src/notebook.ts`)

```ts
export type GapStatus = "strong" | "thin" | "missing";
export interface GapCriterion {
  criterion: string;               // e.g. "Trade-off analysis"
  status: GapStatus;               // strong=green, thin=amber, missing=red
  finding: string;                 // short, plain-language
  suggestions: string[];           // concrete prompts for a human, never written content
  evidence_refs?: { date: string; subsystem: string }[];
}
export interface GapPayload {
  criteria: GapCriterion[];
}

export interface CoverageSubsystem {
  name: string;
  entries: number;
  failures: number;
  buildNeedsOpen: number;
  buildNeedsResolved: number;
  numericEntries: number;
}
export interface CoverageStats {
  subsystems: CoverageSubsystem[];
  photos: { total: number; byKind: Record<string, number> };
  spread: { firstDate: string | null; lastDate: string | null; meetingCount: number; largestGapDays: number };
  totals: { submissions: number; failures: number; numericEntries: number };
}

export interface SeasonExport {
  meetingDays: { id: string; date: string; title: string | null }[];
  submissions: { date: string; subsystem: string | null; kind: string; content: string | null; created_by: string | null }[];
  attendance: { date: string; present: string[] }[];
  deadlines: { title: string; category: string | null; due_date: string; status: string | null; description: string | null }[];
  media: { date: string | null; subsystem: string | null; caption: string | null; kind: string | null; onMeetingDay: boolean }[];
}
```

Widen `ReportPayload` to `TimelinePayload | GapPayload`. Hard rule carried from the PRD: `finding`
and `suggestions` are prompts and observations for a human, never finished notebook prose, and never
invented facts or numbers.

## 6. Frontend: Gaps tab

- New `frontend/src/notebook/GapsTab.tsx`: renders `GapPayload.criteria` as one RAG card each,
  colored by `status` (strong green, thin amber, missing red), showing the criterion name, the
  finding, and a bulleted `suggestions` list. Empty state when there are no criteria.
- `NotebookView`: enable the Gaps tab (remove its "(soon)" disabled state), render `GapsTab` from
  `reports.gaps?.payload`. Empty state when no gaps report exists yet: "No gap analysis yet."
- Controls for AI kinds differ from Timeline: there is no in-app Generate button (Gaps cannot be
  Worker-computed). Members see "Request refresh" (existing `requestRefresh("gaps")`); admin sees the
  pending-request count plus a short hint: "Refresh by running NOTEBOOK_PREP.md in Claude Code." The
  "last updated" line uses the gaps report `generated_at`.

The Gaps tab keeps the Notebook Prep view's own style and the persistent "not a notebook" banner
already shipped in Slice B.

## 7. The runbook (`NOTEBOOK_PREP.md`, Gaps section)

A doc the operator opens in a Claude Code session. Documents, in order: fetch `/season` and
`/coverage`; read `FGC_NOTEBOOK_REFERENCE_BRIEF.md` (criteria are read from the brief, never
hardcoded); reason to produce a `GapPayload` grounded in the brief's criteria, flagging thin or
missing coverage with concrete `suggestions` and `evidence_refs`, never writing notebook prose and
never inventing numbers; then POST `{ kind: "gaps", payload }` to `/api/notebook/publish` with the
`X-Notebook-Secret` header. Includes the exact request shape and a note that the secret must be set.

## 8. Testing

Worker (existing D1/R2 vitest harness):
- `/coverage` computes expected counts from seeded data that includes an open and a resolved
  build-need, a failure, and an entry with a digit in its content, across two subsystems and a
  null-subsystem entry (Uncategorized); verifies per-subsystem counts, photo-by-kind, and the
  largest-gap-in-days spread across at least two meeting dates.
- `/season` returns the normalized shape (submissions carry verbatim content; media metadata only).
- `/publish`: `503` when the secret env var is unset; `401` with a missing or wrong header; `200`
  with the correct header, upserting the report by kind and flipping a pending gaps request to
  fulfilled. A second publish of the same kind replaces, not duplicates.

Frontend: `GapsTab` renders one card per criterion colored by status from a fixture `GapPayload`;
`NotebookView` shows the Gaps tab enabled (not disabled) and renders the empty state with no report.

## 9. Deploy note

`NOTEBOOK_PUBLISH_SECRET` must be set once via `wrangler secret put NOTEBOOK_PUBLISH_SECRET` before
publish works. The read endpoints and the Gaps tab (empty state) ship without it.

## 10. Deferred seams

- Decisions tab + `DecisionPayload` (Slice D), Scaffold tab + `ScaffoldPayload` (Slice E). Both
  reuse `/publish`, `/season`, `/coverage`, and the runbook pattern unchanged.
- Tagging media with a subsystem at upload time (would sharpen photo coverage and gap findings).
