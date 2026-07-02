# Notebook Prep pipeline runbook

The Notebook Prep reports are produced by Claude Code, run by the admin. There is no runtime AI
service and no cost. This runbook is the procedure to author and publish a report. It never writes
the notebook: it flags gaps, structures raw material, and asks the questions a judge would.

## Prerequisites
- The Worker secret `NOTEBOOK_PUBLISH_SECRET` is set (once): `wrangler secret put NOTEBOOK_PUBLISH_SECRET`.
- You know the deployed Worker base URL, e.g. `https://weeklog-worker.fgcworker.workers.dev`.

## Gaps report

1. Fetch the inputs (public reads, no auth):
   - `GET {BASE}/api/notebook/season` (the logged season, media metadata only)
   - `GET {BASE}/api/notebook/coverage` (objective counts)
2. Read `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`. The audit criteria come from the brief, not from
   code. Treat the brief as the standard.
3. Reason to a `GapPayload`. For each criterion in the brief's section 2, decide `status`
   (`strong` | `thin` | `missing`) from the coverage numbers and the season content, write a short
   plain-language `finding`, and give concrete `suggestions` (prompts for the team, never written
   notebook content). Add `evidence_refs` ({date, subsystem}) where you did or did not find evidence.
   Do not invent facts or numbers. Where a "why" or a measurement is missing, say it is missing.
   Shape:
   `{ "criteria": [ { "criterion": "Trade-off analysis", "status": "thin", "finding": "...", "suggestions": ["..."], "evidence_refs": [ { "date": "2026-06-17", "subsystem": "Shooter" } ] } ] }`
4. Publish it (machine write-back, secret-gated):
   `POST {BASE}/api/notebook/publish`
   Header: `X-Notebook-Secret: {the secret}`
   Body: `{ "kind": "gaps", "payload": { ...the GapPayload... } }`
   A 200 means it is live; the Gaps tab now shows the cards, and any pending gaps refresh requests
   are marked fulfilled.

Rules: no runtime LLM calls, no image bytes (photos are used by metadata only), no invented facts or
numbers, and the output is never a submittable notebook. No em dashes.

## Decisions report

1. Fetch the inputs (public reads, no auth): `GET {BASE}/api/notebook/season` and, for context,
   `GET {BASE}/api/notebook/coverage`.
2. Read `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`. Decisions are the brief's section 2.3 (trade-off
   analysis) and 2.4 (numeric justification) material.
3. Scan the season for decision points: a change of approach, a rejected option, a redesign. Produce
   a `DecisionPayload`. For each decision, `title` and `chosen` come from the logged data; `missing`
   lists which of `why` / `numbers` / `alternatives` / `result` are absent; `prompt` tells the team
   what to add. Add `date` and `subsystem` when the logged entry has them. Never invent the reason,
   the numbers, or the result. Where they are missing, that is the point of the flag.
   Shape:
   `{ "decisions": [ { "title": "Switched 6-wheel to 4-wheel drivetrain", "date": "2026-06-17", "subsystem": "Drivetrain/Collector", "chosen": "Went with 4-wheel", "missing": ["why","numbers"], "prompt": "Explain why 4-wheel won and the numbers behind it" } ] }`
4. Publish it: `POST {BASE}/api/notebook/publish`, header `X-Notebook-Secret: {the secret}`, body
   `{ "kind": "decisions", "payload": { ...the DecisionPayload... } }`. A 200 means the Decisions tab
   now shows the checklist and pending decisions requests are marked fulfilled.

Rules: same as the Gaps report. No invented facts or numbers, output is never a submittable notebook,
no em dashes.
