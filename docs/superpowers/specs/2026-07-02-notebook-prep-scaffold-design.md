# Notebook Prep, Slice E: Scaffold

Date: 2026-07-02
Status: Approved for planning
Source PRD: `PRD'S/PRD_notebook_prep.md` (section 4.3, 5.1d, 5.2)
Reference brief: `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`
Builds on: Slices B, C, D (all shipped and live)

## 1. Purpose and scope

Slice E adds the Scaffold report, the last of the four Notebook Prep tabs and the thing the team
actually works from: a notebook SKELETON marked NOT FOR SUBMISSION, with section headings, the team's
own logged words as raw material, and `[NEEDS: ...]` slots everywhere a human must add reasoning,
math, or narrative. It is authored offline by Claude Code (consuming the gaps, decisions, and season)
and published through the existing secret-gated write-back, exactly like Gaps and Decisions. Shipping
it makes all four tabs live and completes the pipeline.

In scope:
1. `ScaffoldPayload` shared type; widen `ReportPayload`.
2. A Scaffold worksheet tab (DRAFT banner, sections with raw material and NEEDS slots, plus a
   copy-raw-markdown action) wired into the Notebook Prep view.
3. A Scaffold section in `NOTEBOOK_PREP.md`.

Out of scope: nothing further in the pipeline; this is the final slice. No worker route changes (see
below).

## 2. Worker: no changes required

The `notebook` router already supports this kind end to end: `KINDS` includes `"scaffold"`, so
`POST /publish` accepts it and `POST /requests` validates it; `saveReport` upserts any kind and
fulfils that kind's pending requests; `GET /reports` returns it. So this slice adds no worker code.
The reasoning is done offline by Claude Code (no runtime LLM, zero cost).

## 3. Shared type (`types/src/notebook.ts`)

Per PRD 5.1d:

```ts
export interface ScaffoldSection {
  heading: string;
  raw_material: string[]; // the team's own logged words, verbatim
  needs: string[];        // prompts for a human, rendered as [NEEDS: ...] slots
}
export interface ScaffoldPayload {
  draft_notice: string;   // fixed NOT FOR SUBMISSION text
  sections: ScaffoldSection[];
}
```

Widen `ReportPayload` to `TimelinePayload | GapPayload | DecisionPayload | ScaffoldPayload`.

Hard rule carried from the PRD: `raw_material` is the team's own logged words, verbatim, never
rewritten; `needs` are prompts and questions for a human, never finished notebook prose, never
invented facts or numbers. The output is deliberately un-submittable.

## 4. Frontend: Scaffold tab

- New `frontend/src/notebook/ScaffoldTab.tsx`: renders the DRAFT worksheet.
  - A prominent DRAFT banner at the top of the tab, from `draft_notice` (with a defensive default,
    e.g. "DRAFT. NOT FOR SUBMISSION. The team writes the notebook.", if the field is empty). This is
    visually stronger than the view-wide "not a notebook" banner and uses the bad/warn color to read
    as "do not submit this".
  - Then each section: the `heading`, the `raw_material` as verbatim bullets, and the `needs` as
    visibly-marked amber slots rendered as "NEEDS: <prompt>" (using `var(--warn)`).
  - A "Copy raw markdown" button that assembles the scaffold into markdown and copies it to the
    clipboard (via `navigator.clipboard.writeText`), so whoever transfers material into the real
    notebook doc can grab it. Markdown shape: a top-level line with the draft notice, then per
    section a `## heading`, the `raw_material` as `-` bullets, and each `need` as a `[NEEDS: ...]`
    line.
  - `Array.isArray(payload.sections)` guard + empty state "No scaffold yet."
- `NotebookView`: flip the Scaffold tab entry to `ready: true` (keeping `deterministic: false`), and
  render `ScaffoldTab` from `reports.scaffold?.payload`. Controls behave exactly like Gaps and
  Decisions (member Request-refresh, admin pending-count + "run NOTEBOOK_PREP.md" hint, no in-app
  Generate). With this change no tab remains disabled; the "(soon)" state is gone entirely.

The Scaffold tab keeps the Notebook Prep view's own style and the persistent view-wide "not a
notebook" banner.

## 5. Runbook (`NOTEBOOK_PREP.md`, Scaffold section)

Add a Scaffold section: consume the published gaps and decisions plus `/season`, and produce a
`ScaffoldPayload`. Section headings follow subsystem or design-process stage; `raw_material` is the
team's own logged words, verbatim; `needs` mark every place a human must add reasoning, math, or
narrative (phrased as questions, never answered). `draft_notice` is the fixed NOT FOR SUBMISSION
text. Never invent content and never write the notebook prose. Publish `{ kind: "scaffold", payload }`
to `/api/notebook/publish` with the `X-Notebook-Secret` header. Include the exact request shape.

## 6. Testing

Frontend:
- `ScaffoldTab` renders the draft banner from `draft_notice`, a section heading, its `raw_material`
  bullets, and its `needs` slots (as "NEEDS: ..."), from a fixture `ScaffoldPayload`. Shows the empty
  state for `{ draft_notice: "...", sections: [] }`. A separate assertion covers the copy button:
  clicking it calls `navigator.clipboard.writeText` (mocked) with markdown containing the heading and
  a raw-material bullet.
- `NotebookView` test updated: the Scaffold tab is enabled and switchable and renders its empty state
  ("No scaffold yet."); assert no remaining tab button is disabled.

No worker tests: this slice adds no worker code. The existing publish/requests/reports tests already
cover the `scaffold` kind generically.

## 7. Guardrails honored

- No runtime LLM API; reasoning is offline. Zero cost.
- `raw_material` is verbatim; `needs` only flag and ask; no invented facts or numbers.
- Output is deliberately un-submittable, marked DRAFT / NOT FOR SUBMISSION.
- No em dashes anywhere in code, tests, UI copy, or docs.

## 8. Completion note

With Scaffold shipped, all four Notebook Prep report kinds (timeline, gaps, decisions, scaffold) are
built and live, and `NOTEBOOK_PREP.md` documents authoring and publishing each. The pipeline's v1
scope from the PRD is complete. Remaining PRD-deferred items (judge-question rehearsal, notebook
health over time, DOCX export, subsystem-tagging media at upload) stay explicitly out of scope.
