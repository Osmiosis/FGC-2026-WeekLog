# PRD: WeekLog Notebook Prep Pipeline (FGC 2026)

## 0. Read this first (context + the unusual runtime model)

This extends the existing **WeekLog** app (Team Qatar's FGC 2026 meeting compliance tracker:
Cloudflare Pages + Workers + D1 + R2, TypeScript). It adds a **Notebook Prep** capability: a pipeline
that reads the team's logged season and helps them build a strong FGC engineering notebook, WITHOUT
writing the notebook for them.

**The pipeline is a SUPER HELPER, not a ghost-writer.** It structures raw material, audits coverage
against real FGC judging standards, and surfaces the decisions and questions a judge would care about.
The team writes the actual notebook. This constraint is non-negotiable and is enforced by the output
format (Section 5): outputs are deliberately un-submittable (reports, skeletons, the team's own logged
words, and `[NEEDS: ...]` placeholders), never finished prose.

### Runtime model (READ CAREFULLY — this is unusual)
- There is **NO LLM API** wired into this system. No Anthropic API key, no runtime AI calls, no cost.
- **Claude Code is BOTH the builder AND the reasoning engine.** Claude Code builds the deterministic
  tools below, and Claude Code itself performs the two AI-reasoning steps (gap analysis, decision
  extraction) by reading the intermediate data files + the reference brief, then writing report files.
- The operator (Aarav) runs the pipeline from Claude Code when they choose (e.g. weekly, or before a
  judging deadline). It is not an always-on service.
- **The reference brief** `FGC_NOTEBOOK_REFERENCE_BRIEF.md` (shipped alongside this PRD) MUST be read
  by Claude Code before any audit/extraction step, so reasoning is grounded in real FGC standards.

### Data flow
```
WeekLog (live D1/R2)  ->  [deterministic export tool]  ->  intermediate JSON files
        ->  [deterministic tools: subsystem timelines, coverage stats]  ->  more JSON
        ->  Claude Code reads JSON + reference brief  ->  writes STRUCTURED JSON reports
        ->  [write-back tool]  ->  a new "Notebook Prep" view in WeekLog that RENDERS the
                                   structured JSON as friendly cards / checklists / timelines
```

Note: the pipeline publishes STRUCTURED JSON (not markdown blobs) against fixed schemas (Section 5.1),
and the Notebook Prep view renders that JSON into its own friendly, RAG-legible UI (Section 5.2). The
JSON schema is a CONTRACT shared by the pipeline and the UI; if they disagree on shape, nothing renders,
so the schemas must be defined and typed once in the shared `/types` workspace.

## 1. Goals & non-goals

### Goals (v1, built step-by-step — each phase independently useful)
1. Pull the live WeekLog season data (via API/D1) into clean intermediate JSON.
2. **Subsystem timelines** (deterministic, no AI): per-subsystem chronological threads.
3. **Gap analysis** (Claude Code reasoning): coverage against the FGC criteria in the brief.
4. **Decision-log extraction** (Claude Code reasoning): surface decision points + flag undocumented
   "why" / missing numbers.
5. Write all outputs back to a **Notebook Prep view inside WeekLog** for teammates to see (web only).

### Non-goals (v1)
- NO judge-formatted DOCX / house-style export. Deliberately excluded so nobody submits the output
  as-is. (Markdown raw-material export is allowed; polished doc export is not.)
- NO runtime LLM API calls. NO cost.
- NO photo pixel analysis. Photos are used only via their METADATA (caption, subsystem, kind, date).
- NO notebook-health-over-time scoring (explicitly deferred).
- NO judge-question rehearsal in v1 (deferred to a later phase; leave a seam).

## 2. The reference brief (grounding — REQUIRED)
Ship and read `FGC_NOTEBOOK_REFERENCE_BRIEF.md`. It defines the FGC target (Katherine Johnson Award
for Engineering Documentation, judged on the season "journey") and the audit criteria (engineering
process evidence, lessons learned, trade-off analysis, mathematical justification, tests/results,
season-long coverage, captioned visuals, individual contributions, clarity). Every reasoning step
measures the logged data against these criteria. Do not hardcode criteria in code; read them from the
brief so they can be enriched over time.

## 3. Deterministic tools (NO AI — build these first, they are cheap and always-run)

### 3.1 Data access / export
- A tool (Worker route or script using the existing WeekLog D1/R2 access) that pulls: all meeting_days,
  submissions (accomplishments, build_needs, failures, performance_goals, notes, tagged by subsystem +
  date), attendance, deadlines, and media METADATA (caption, subsystem, kind, date, which day). Output
  a single normalized `season.json`. No image bytes.
- Must reuse WeekLog's existing auth/data layer; do not duplicate DB logic.

### 3.2 Subsystem timelines (Job: restructure)
- From `season.json`, assemble per-subsystem (Drivetrain, Collector, Shooter, Climber, Programming,
  Strategy, etc.) a chronological thread: every dated entry touching that subsystem, in order, with its
  accomplishments/failures/build-needs and any photo metadata for that subsystem/date.
- Output `timelines.json` (structured) AND a human-readable `timelines.md`. Pure data restructuring,
  no AI. This is the first shippable win.

### 3.3 Coverage statistics (feeds gap analysis)
- Compute objective coverage numbers the reasoning step will interpret: entries per subsystem, count
  of failures logged, count of build-needs resolved vs open, photo counts by kind (sketch vs build)
  and by subsystem, documentation spread across the season (gaps > N days), how many entries contain
  any numeric content (quick heuristic for "quantified decisions"). Output `coverage.json`.

## 4. Claude Code reasoning steps (AI, run manually inside Claude Code, no API/cost)

### 4.1 Gap analysis
Claude Code reads the reference brief + `timelines.json` + `coverage.json` and produces a **GapPayload**
(Section 5.1b): for each FGC criterion, a `status` (strong/thin/missing), a plain-language `finding`,
and concrete actionable `suggestions`. Examples of the KIND of finding wanted:
- criterion "Trade-off analysis", status "thin": "Only 1 documented decision across 8 meetings; judges
  expect several." suggestions: ["Write up the 6-wheel -> 4-wheel change (meeting 9)"].
- criterion "Design iteration photos", status "missing": "Shooter has 12 build photos but 0 sketches;
  document iterations, not just final builds."
It FLAGS and PROMPTS via structured fields. It does not fill the gaps or write prose.

### 4.2 Decision-log extraction
Claude Code scans the timelines for decision points (a change of approach, a rejected option, a
redesign) and produces a **DecisionPayload** (Section 5.1c): each candidate decision with `chosen`
(from logged data), a `missing[]` list (why / numbers / alternatives / result), and a `prompt` telling
the team what to add. It never invents reasons or numbers; missing pieces are flagged for a human.

### 4.3 Scaffold assembly (consumes 4.1 + 4.2 + timelines)
Produce a **ScaffoldPayload** (Section 5.1d): a notebook SKELETON marked NOT FOR SUBMISSION, with
section headings per subsystem / design-process stage, the team's OWN logged words as `raw_material`,
and `needs[]` placeholders everywhere a human must add reasoning, math, or narrative. It renders as a
worksheet, never finished prose. This is the thing the team works FROM.

## 5. Write-back to WeekLog: the "Notebook Prep" view (REQUIRED)

The team must see this in WeekLog, rendered as a **friendly, easy-to-act-on UI**, not a wall of
markdown. The pipeline publishes STRUCTURED JSON; the view renders it into cards, checklists, and a
timeline. Un-submittable in SUBSTANCE (raw material + audit + placeholders, never finished notebook
prose) but genuinely PLEASANT and CLEAR in PRESENTATION. Those two goals are compatible and both
required: an intimidating text dump gets ignored, and an ignored tool is a dead tool.

### 5.1 The publish contract (STRUCTURED JSON — define once in shared `/types`)
The pipeline writes typed JSON, not markdown. Each report kind has a fixed schema. The UI renders these.
If pipeline and UI disagree on shape, nothing renders, so type these in `/types` and share them.

```ts
// A published report row (table: notebook_reports)
type ReportKind = 'timeline' | 'gaps' | 'decisions' | 'scaffold';
type NotebookReport = {
  id: string;
  kind: ReportKind;
  generated_at: string;   // ISO
  payload: TimelinePayload | GapPayload | DecisionPayload | ScaffoldPayload;
};

// 5.1a Subsystem timelines
type TimelinePayload = {
  subsystems: Array<{
    name: string;                       // "Shooter", "Drivetrain", ...
    entries: Array<{
      date: string;
      kind: 'accomplishment'|'failure'|'build_need'|'goal'|'note';
      subsystem: string;
      text: string;                     // the team's OWN logged words, verbatim
      photos: Array<{ caption: string; kind: string }>;  // metadata only, no bytes
    }>;
  }>;
};

// 5.1b Gap analysis (renders as RAG cards, one per FGC criterion from the brief)
type GapPayload = {
  criteria: Array<{
    criterion: string;                  // e.g. "Trade-off analysis"
    status: 'strong' | 'thin' | 'missing';   // maps to green / amber / red
    finding: string;                    // short, plain-language
    suggestions: string[];              // concrete, actionable prompts (NOT written content)
    evidence_refs?: Array<{ date: string; subsystem: string }>;  // where we did/didn't find it
  }>;
};

// 5.1c Decision worksheet (renders as a checklist)
type DecisionPayload = {
  decisions: Array<{
    title: string;                      // "Switched 6-wheel -> 4-wheel drivetrain"
    date?: string;
    subsystem?: string;
    chosen: string;                     // what was chosen, from logged data
    missing: Array<'why' | 'numbers' | 'alternatives' | 'result'>;  // what a human must add
    prompt: string;                     // "Explain why 4-wheel won and the numbers behind it"
  }>;
};

// 5.1d Scaffold (renders as an outline of sections with raw material + [NEEDS] slots)
type ScaffoldPayload = {
  draft_notice: string;                 // fixed "NOT FOR SUBMISSION" text
  sections: Array<{
    heading: string;
    raw_material: string[];             // the team's own logged words, verbatim
    needs: string[];                    // "[NEEDS: why did we choose this?]" style prompts
  }>;
};
```
Hard rules on payload content: `text` and `raw_material` are the team's OWN logged words, verbatim,
never AI-rewritten. `suggestions`, `prompt`, and `needs` are prompts/questions for a human, never
finished prose and never invented facts or numbers.

### 5.2 The Notebook Prep view (friendly rendering — its OWN visual style)
Add a **Notebook Prep** route in the WeekLog frontend. It uses its OWN visual style, distinct from
the compliance dashboard (a Notebook-Prep "needs work" is a different KIND of thing from a missed
meeting, so keeping them visually separate prevents confusion), but it must still be RAG-LEGIBLE at a
glance (a person should intuit strong / needs-work / missing without instruction).

- **Gaps tab:** one card per FGC criterion, colour-coded by `status` (strong/thin/missing), showing
  the finding and a short bulleted list of suggestions. Scannable in seconds. This is the headline
  screen: "where is our notebook weak?"
- **Decisions tab:** a checklist. Each decision is a row showing what was chosen and clear chips for
  what's missing (why / numbers / alternatives / result), with the fill-in prompt. Reuses the
  interaction FEEL of WeekLog's requirement checklist so it's instantly familiar even in a new style.
- **Timeline tab:** pick a subsystem, see its chronological arc as an actual timeline (dated entries,
  colour by kind, photo captions inline). Lets a subteam scan their own thread.
- **Scaffold tab:** the outline with raw material under each heading and `[NEEDS: ...]` slots visibly
  marked, plus a fixed DRAFT / NOT FOR SUBMISSION banner.
- **A "copy raw markdown" action** per report is allowed (for whoever transfers material into the real
  notebook doc). NO polished DOCX export.
- **Persistent banner** on the whole view: "Draft raw material and audit for the team's engineering
  notebook. Not a notebook. The team writes the notebook."
- Access: same WeekLog auth. All members view; only admin triggers a publish/update.

### 5.3 Write-back mechanics
- Table `notebook_reports` (id, kind, generated_at, payload JSON).
- A Worker route (admin-gated) accepts a published `NotebookReport` and upserts it by kind (latest
  wins). The Notebook Prep view reads the latest report of each kind and renders per 5.2.

## 6. Build order (phase-gated; each phase independently useful)
1. **Data access/export** (3.1): `season.json` from live WeekLog. Nothing works without this.
2. **Subsystem timelines** (3.2): `timelines.json` (matching TimelinePayload) + a `.md` copy. No AI.
3. **Shared types + Notebook Prep view + write-back** (5): define the JSON schemas in `/types`, build
   the `notebook_reports` table + admin write-back route, and the friendly view that renders the
   Timeline tab first. Publish timelines so the team sees value early.
4. **Coverage stats** (3.3): `coverage.json`.
5. **Gap analysis** (4.1): first Claude Code reasoning step -> GapPayload -> Gaps tab (RAG cards).
6. **Decision-log extraction** (4.2): DecisionPayload -> Decisions tab (checklist).
7. **Scaffold assembly** (4.3): ScaffoldPayload -> Scaffold tab (DRAFT, raw material + needs slots).
8. Docs: how to run the pipeline from Claude Code; how to enrich the reference brief.
(Deferred, leave seams: judge-question rehearsal; notebook-health-over-time; DOCX export.)

## 7. Guardrails & acceptance criteria
- ZERO runtime LLM API calls; the only AI is Claude Code, run manually. $0 ongoing cost.
- The reference brief is read before every reasoning step; criteria are not hardcoded in source.
- No output is a submittable notebook. Every published artifact is a report, timeline, decision
  worksheet, or DRAFT-marked scaffold containing the team's own words + `[NEEDS: ...]` placeholders.
- No invented facts, reasons, or numbers. Where the "why" or a measurement is missing, the pipeline
  FLAGS it for a human, never fabricates it.
- Photos are used by metadata only; no image bytes are sent to any AI step.
- The pipeline publishes STRUCTURED JSON against the Section 5.1 schemas (typed in `/types`), and the
  Notebook Prep view renders it as friendly, RAG-legible cards / checklists / timelines, NOT raw
  markdown. A teammate can open the Gaps tab and understand what to fix in seconds.
- The Notebook Prep view is visible to all members in WeekLog with the "not a notebook" banner.
- Deterministic tools (phases 1-4) work with no AI at all and are independently useful.
- No em dashes anywhere (standing WeekLog rule).

## 8. Deliverables
- New pipeline code (scripts and/or Worker routes) reusing WeekLog's D1/R2/auth layer.
- `season.json` / `timelines.(json|md)` / `coverage.json` producers.
- Shared JSON schemas (Section 5.1) typed in the `/types` workspace, imported by BOTH the pipeline and
  the frontend so the contract can't drift.
- The Notebook Prep frontend view (its own style, RAG-legible; Timeline/Gaps/Decisions/Scaffold tabs)
  + `notebook_reports` table + admin write-back route + migration.
- `NOTEBOOK_PREP.md`: how to run each phase from Claude Code, in order; how the brief grounds the
  reasoning; the hard rule that the pipeline never writes the notebook.
- Ships with `FGC_NOTEBOOK_REFERENCE_BRIEF.md` in the repo.
