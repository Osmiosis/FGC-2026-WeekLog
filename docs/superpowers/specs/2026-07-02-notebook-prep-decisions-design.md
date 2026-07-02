# Notebook Prep, Slice D: Decisions

Date: 2026-07-02
Status: Approved for planning
Source PRD: `PRD'S/PRD_notebook_prep.md` (section 4.2, 5.1c, 5.2)
Reference brief: `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`
Builds on: Slice C (`docs/superpowers/specs/2026-07-02-notebook-prep-gaps-design.md`, shipped and live)

## 1. Purpose and scope

Slice D adds the Decisions report: a worksheet that surfaces the season's decision points (a change
of approach, a rejected option, a redesign) and, for each, flags what a judge would expect that the
team has not yet documented (the why, the numbers, the alternatives, the result). It is authored
offline by Claude Code and published through the existing secret-gated write-back, exactly like Gaps.

This slice reuses all Slice-C infrastructure and adds only a payload type, a tab, and a runbook
section. It is deliberately thin.

In scope:
1. `DecisionPayload` shared type; widen `ReportPayload`.
2. A Decisions checklist tab wired into the Notebook Prep view.
3. A Decisions section in `NOTEBOOK_PREP.md`.

Out of scope: Scaffold (Slice E). No worker route changes (see below).

## 2. Worker: no changes required

The `notebook` router already supports this kind end to end:
- `KINDS` includes `"decisions"`, so `POST /publish` accepts it and `POST /requests` validates it.
- `saveReport` upserts any kind and fulfils that kind's pending requests.
- `GET /reports` returns the latest report per kind, including `decisions`.
- `GET /season` and `GET /coverage` already supply the reasoning inputs.

So this slice adds no worker code. The reasoning is done offline by Claude Code (no runtime LLM,
zero cost).

## 3. Shared type (`types/src/notebook.ts`)

Per PRD 5.1c:

```ts
export type DecisionMissing = "why" | "numbers" | "alternatives" | "result";
export interface Decision {
  title: string;              // "Switched 6-wheel to 4-wheel drivetrain"
  date?: string;
  subsystem?: string;
  chosen: string;             // what was chosen, taken from logged data
  missing: DecisionMissing[]; // what a human must still add
  prompt: string;             // "Explain why 4-wheel won and the numbers behind it"
}
export interface DecisionPayload {
  decisions: Decision[];
}
```

Widen `ReportPayload` to `TimelinePayload | GapPayload | DecisionPayload`.

Hard rule carried from the PRD: `chosen` is drawn from the team's logged data; `missing` and
`prompt` flag and ask, never invent the reason, the numbers, or the result.

## 4. Frontend: Decisions tab

- New `frontend/src/notebook/DecisionsTab.tsx`: renders `DecisionPayload.decisions` as a checklist,
  echoing the feel of WeekLog's requirement checklist. One card per decision showing: the `title`
  (with `date` and `subsystem` shown when present), the `chosen` line, a set of chips for each item
  in `missing` (why / numbers / alternatives / result) styled to read "still needed" (amber, using
  `var(--warn)`), and the `prompt` as the fill-in call to action. Chips render only for items present
  in `missing`. Empty state: "No decision worksheet yet."
- `NotebookView`: flip the Decisions tab entry to `ready: true` (keeping `deterministic: false`), and
  render `DecisionsTab` from `reports.decisions?.payload`. Controls behave exactly like the Gaps tab:
  members see Request-refresh (`requestRefresh("decisions")`); admin sees the pending-request count
  and the "Refresh by running NOTEBOOK_PREP.md in Claude Code" hint; no in-app Generate. The
  "last updated" line uses the decisions report `generated_at`.
- Scaffold stays `ready: false` ("(soon)").

The Decisions tab keeps the Notebook Prep view's own style and the persistent "not a notebook"
banner.

## 5. Runbook (`NOTEBOOK_PREP.md`, Decisions section)

Add a Decisions section mirroring the Gaps section: fetch `/season` (and `/coverage` for context),
read the reference brief, scan the season for decision points, and emit a `DecisionPayload`. For each
decision, `chosen` comes from the logged data, `missing` lists which of why/numbers/alternatives/
result are absent, and `prompt` tells the team what to add. Never invent the reason or the numbers;
where they are missing, that is the point of the flag. Publish `{ kind: "decisions", payload }` to
`/api/notebook/publish` with the `X-Notebook-Secret` header. Include the exact request shape.

## 6. Testing

Frontend:
- `DecisionsTab` renders one card per decision from a fixture `DecisionPayload`, shows the `chosen`
  text and the `prompt`, renders a chip for each `missing` item and omits chips not in `missing`, and
  shows the empty state for `{ decisions: [] }`.
- `NotebookView` test updated: the Decisions tab is enabled and switchable and renders its empty
  state ("No decision worksheet yet."); Scaffold remains disabled.

No worker tests: this slice adds no worker code. The existing publish/requests/reports tests already
cover the `decisions` kind generically.

## 7. Guardrails honored

- No runtime LLM API; reasoning is offline. Zero cost.
- No invented reasons, numbers, or results; the pipeline flags what is missing.
- Reasoning outputs are prompts and observations, never finished notebook prose.
- No em dashes anywhere in code, tests, UI copy, or docs.

## 8. Deferred

- Scaffold tab + `ScaffoldPayload` (Slice E), which reuses the same publish path, `/season`,
  `/coverage`, and runbook pattern.
