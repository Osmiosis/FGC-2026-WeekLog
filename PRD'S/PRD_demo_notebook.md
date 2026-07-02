# PRD: WeekLog Demo — Notebook Prep tabs (extend the `demo` branch)

## 0. Context

WeekLog has a public, backend-free demo on the **`demo`** branch: the frontend's `/api/...` calls are
intercepted by an in-browser mock (`frontend/src/lib/demo/`) that serves seeded sample data from
localStorage. No Worker, no D1, no R2. Real Supabase magic-link auth is kept; everyone signed in is
admin; a "DEMO / Reset" pill resets the sample data.

Since the demo was last built, the real app gained the **Notebook Prep** feature: four tabs (Timeline,
Gaps, Decisions, Scaffold) rendered from reports published into `notebook_reports`. The demo currently
does NOT cover these tabs, so it looks half-finished. This PRD adds them to the demo.

## 1. Goal & approach

Make the demo's Notebook Prep view an **interactive showcase**: the four tabs (Timeline, Gaps,
Decisions, Scaffold) start locked, and a Generate action reveals **pre-baked static seed reports**
(Option A: static showcase, gated behind a simulated generate step). The demo does NOT generate
anything for real, calls NO AI (not the operator's, not the visitor's), needs NO publish secret, and
involves NO Claude Code. It renders four reports that were already generated on the live site and
captured as seed JSON, revealed via a clearly-labelled simulated generate.

This mirrors exactly how the demo already seeds meetings/deadlines: static sample data served by the
in-browser mock router.

### Non-goals
- No REAL generation of any report in the demo (not even the deterministic Timeline). The demo's
  Generate is a labelled simulation that reveals seeded data; it computes nothing.
- No AI calls of any kind. No API keys. No bring-your-own-key.
- No publish/write-back route, no secret, no Worker.
- No new report content authored here; reuse the reports already generated on the live site.
- The simulated "generating" state must never claim a real AI call is happening.

## 2. Source of the seed content

The four current reports will be captured from the live site's `GET /api/notebook/reports` (which
returns the latest snapshot per kind: `timeline`, `gaps`, `decisions`, `scaffold`). Save each report's
payload verbatim as static seed JSON in the demo.

- The operator confirms these reports contain no sensitive info. STILL: before committing, eyeball the
  payloads for real member names in logged text / raw material, and scrub or pseudonymize any the team
  would not want on a public demo. (Attendance names live elsewhere, but logged submission text and
  scaffold raw_material can contain names.)
- Capture is a one-time manual step by the operator; the demo does not fetch from the live site at
  runtime.

## 3. What to build (all on the `demo` branch)

### 3.1 Seed the reports
- Add the four captured report payloads to the demo seed layer (alongside the existing meeting/deadline
  seed in `frontend/src/lib/demo/seed.ts`), typed with the existing shared `@weeklog/types` report
  contracts (`TimelinePayload`, `GapPayload`, `DecisionPayload`, `ScaffoldPayload`).
- Store them under the demo's localStorage state so "DEMO / Reset" restores them too.

### 3.2 Mock the notebook API routes
- Extend the demo mock router (`frontend/src/lib/demo/router.ts`) to answer the Notebook Prep endpoints
  the frontend calls, returning the seeded reports:
  - `GET /api/notebook/reports` -> the four seeded snapshots.
  - Any per-kind report read the view uses -> the matching seed.
- These handlers return canned data only; they never compute or call out.

### 3.3 Locked-until-generate reveal flow (the demo's interactive showcase)
Instead of showing the reports on arrival, the demo gates them behind a Generate action so the visitor
experiences the generation as a step. This also gives the real app's Generate/refresh controls
something to do in the demo, honestly.

Behavior:
- **Initial state:** all four Notebook Prep tabs are LOCKED / greyed out. A Generate control sits up
  top. Locked tabs show a short prompt like "Generate to preview the notebook prep reports."
- **Two-step generation, mirroring the real app** (Timeline is deterministic and separate; the three
  reasoning tabs are a group):
  - A **"Generate Timeline"** action unlocks and populates the Timeline tab from its seed.
  - A **"Generate reasoning reports"** action unlocks and populates Gaps, Decisions, and Scaffold
    together from their seeds.
  (Implement as two distinct controls, or a two-stage single flow; either is fine as long as Timeline
  can generate independently of the three AI tabs.)
- **"Generating" state with an explicit honesty label.** On click, show a brief simulated-progress
  state (roughly 1 to 2 seconds) BEFORE the reports appear, with copy that makes clear this is NOT a
  live AI call, e.g. "Simulating generation. This is sample data, not a real AI call." Optionally show
  a believable line like "Reviewing logged meetings...". The delay is theatre to make the click feel
  like an action; it must never claim real generation is happening.
- After generation, the tab(s) render the seeded reports exactly as the real app renders them.
- **Teammate refresh requests** (`/api/notebook/requests`): mock as a friendly no-op returning an empty
  list; if a control triggers it, show the same "sample data" explainer. Do not hard-error.

### 3.4 Reset behavior
- The existing "DEMO / Reset" pill, in addition to resetting meetings/deadlines, **re-locks the
  Notebook Prep tabs** back to the initial pre-generate state (tabs greyed, only the Generate control
  shown). The seeded report data is restored but hidden again until the visitor re-generates.

### 3.5 Demo framing
- The existing demo banner/badge stays. Add a one-line explainer on the Notebook Prep view: "Sample
  reports. In the real app, WeekLog generates these from a team's logged meetings; the reasoning
  reports are authored offline and published in, at zero runtime AI cost. Generate here is a preview,
  not a live AI call."
- This keeps the demo honest: an interactive showcase of the real product's output, not a pretend live
  pipeline.

## 4. Constraints (inherit from the demo + project rules)
- Backend-free: no Worker, no D1, no R2, no secret. Everything in-browser.
- Auth: keep the existing Supabase magic-link; everyone is admin over sample data.
- Reset: "DEMO / Reset" must also restore the seeded notebook reports.
- No em dashes anywhere (standing project rule).
- Reuse existing patterns: the demo's seed + router + DemoBadge approach, and the app's existing
  Notebook Prep view/components unchanged (the tabs already know how to render the payloads; we are
  only feeding them seeded data through the mock).

## 5. Build order
1. Capture the four live reports (operator, manual) and add them to the demo seed, typed.
2. Extend the demo mock router with the `/api/notebook/reports` (+ any per-kind) handlers returning
   the seeds; mock `/api/notebook/requests` as a friendly no-op.
3. Build the locked-until-generate reveal: greyed tabs initially, a "Generate Timeline" control and a
   "Generate reasoning reports" control, each with a brief clearly-labelled "simulating, not real AI"
   progress state that then unlocks and populates the relevant tab(s) from the seeds.
4. Wire Reset to re-lock the tabs to the pre-generate state; add the Notebook Prep demo explainer line.
5. Verify: tabs locked on load; Timeline generates independently; the three AI tabs generate together;
   the generating state is honestly labelled; Reset re-locks; zero network calls and zero AI; build
   clean; deploy the `demo` Pages project.

## 6. Acceptance criteria
- On load, all four Notebook Prep tabs are LOCKED; only the Generate control(s) are shown.
- "Generate Timeline" reveals and populates the Timeline tab; "Generate reasoning reports" reveals and
  populates Gaps, Decisions, and Scaffold together, each from seeded data.
- Each generate shows a brief progress state whose copy explicitly says it is a simulation / sample
  data, not a real AI call.
- After generation, all four tabs render fully populated exactly as the real app renders them, with
  zero network calls and zero AI.
- "DEMO / Reset" re-locks the Notebook Prep tabs to the initial pre-generate state (and restores the
  rest of the sample data).
- No publish secret, no Worker, no API key anywhere in the demo path.
- Seed payloads have been eyeballed for member names and scrubbed per the operator's decision.
- No em dashes.
