# Notebook Prep (Slice D: Decisions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Decisions worksheet tab: a checklist of the season's decision points, each showing what was chosen and flagging what a human must still add (why / numbers / alternatives / result).

**Architecture:** Reuses all Slice-C infrastructure. The `decisions` report kind is already supported end to end by the worker (publish/requests/reports), so this slice adds only a shared `DecisionPayload` type, a `DecisionsTab` component, the NotebookView wiring, and a runbook section. The report is authored offline by Claude Code and published via the existing secret-gated `/publish`.

**Tech Stack:** React 18 + Vite (frontend), TypeScript, vitest + jsdom.

## Global Constraints

- No em dashes anywhere in code, comments, tests, UI copy, or docs.
- No runtime LLM API; the Decisions report is authored offline by Claude Code. Zero cost.
- `chosen` is drawn from logged data; `missing` and `prompt` flag and ask, never inventing the reason, numbers, or result. Reasoning outputs are never finished notebook prose.
- Shared types live once in `@weeklog/types`, imported type-only by the frontend.
- No worker code changes in this slice (the `decisions` kind is already handled generically).

---

### Task 1: DecisionPayload shared type

**Files:**
- Modify: `types/src/notebook.ts` (append types; widen `ReportPayload`)
- Test: none (types-only; verified by `npm run typecheck`)

**Interfaces:**
- Produces: `DecisionMissing`, `Decision`, `DecisionPayload` from `@weeklog/types`; `ReportPayload` widened to `TimelinePayload | GapPayload | DecisionPayload`.

- [ ] **Step 1: Append the types**

Append to `types/src/notebook.ts`:

```ts
// Decision worksheet (AI-authored offline, published via /publish). Renders as a checklist.
export type DecisionMissing = "why" | "numbers" | "alternatives" | "result";
export interface Decision {
  title: string; // "Switched 6-wheel to 4-wheel drivetrain"
  date?: string;
  subsystem?: string;
  chosen: string; // what was chosen, taken from logged data
  missing: DecisionMissing[]; // what a human must still add
  prompt: string; // "Explain why 4-wheel won and the numbers behind it"
}
export interface DecisionPayload {
  decisions: Decision[];
}
```

- [ ] **Step 2: Widen the report payload union**

In `types/src/notebook.ts`, change:

```ts
export type ReportPayload = TimelinePayload | GapPayload;
```

to:

```ts
export type ReportPayload = TimelinePayload | GapPayload | DecisionPayload;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS for all three workspaces.

- [ ] **Step 4: Commit**

```bash
git add types/src/notebook.ts
git commit -m "feat(types): DecisionPayload contract for Notebook Prep slice D"
```

---

### Task 2: DecisionsTab component

**Files:**
- Create: `frontend/src/notebook/DecisionsTab.tsx`
- Test: `frontend/src/notebook/DecisionsTab.test.tsx`

**Interfaces:**
- Consumes: `DecisionPayload`, `DecisionMissing` from `@weeklog/types`.
- Produces: `DecisionsTab({ payload }: { payload: DecisionPayload })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/notebook/DecisionsTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionsTab } from "./DecisionsTab";
import type { DecisionPayload } from "@weeklog/types";

const payload: DecisionPayload = {
  decisions: [
    {
      title: "Switched 6-wheel to 4-wheel drivetrain",
      date: "2026-06-17",
      subsystem: "Drivetrain/Collector",
      chosen: "Went with 4-wheel",
      missing: ["why", "numbers"],
      prompt: "Explain why 4-wheel won and the numbers behind it",
    },
  ],
};

describe("DecisionsTab", () => {
  it("renders a decision with chosen, only its missing chips, and the prompt", () => {
    render(<DecisionsTab payload={payload} />);
    expect(screen.getByText("Switched 6-wheel to 4-wheel drivetrain")).toBeTruthy();
    expect(screen.getByText("Went with 4-wheel")).toBeTruthy();
    expect(screen.getByText(/Why/)).toBeTruthy();
    expect(screen.getByText(/Numbers/)).toBeTruthy();
    expect(screen.queryByText(/Alternatives/)).toBeNull(); // not in missing
    expect(screen.getByText(/Explain why 4-wheel won/)).toBeTruthy();
  });

  it("shows the empty state for no decisions", () => {
    render(<DecisionsTab payload={{ decisions: [] }} />);
    expect(screen.getByText(/No decision worksheet yet/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/DecisionsTab.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `frontend/src/notebook/DecisionsTab.tsx`:

```tsx
import type { DecisionPayload, DecisionMissing } from "@weeklog/types";

const MISSING_LABEL: Record<DecisionMissing, string> = {
  why: "Why",
  numbers: "Numbers",
  alternatives: "Alternatives",
  result: "Result",
};

// A checklist of decision points. Each card shows what was chosen and amber
// "Needs" chips for what a human must still add. Guard against a malformed
// published payload so a bad report cannot blank the tab.
export function DecisionsTab({ payload }: { payload: DecisionPayload }) {
  if (!Array.isArray(payload.decisions) || payload.decisions.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No decision worksheet yet.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {payload.decisions.map((d, i) => (
        <div key={i} className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{d.title}</span>
            {d.subsystem && <span className="mono-label" style={{ color: "var(--fg-faint)" }}>{d.subsystem}</span>}
            {d.date && <span className="mono-label" style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{d.date}</span>}
          </div>
          <div style={{ fontSize: 14.5, marginBottom: d.missing.length ? 8 : 0 }}>{d.chosen}</div>
          {d.missing.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {d.missing.map((m) => (
                <span
                  key={m}
                  className="mono-label"
                  style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid var(--warn)", color: "var(--warn)" }}
                >
                  Needs: {MISSING_LABEL[m]}
                </span>
              ))}
            </div>
          )}
          <div className="mono-label" style={{ color: "var(--fg-dim)" }}>{d.prompt}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/DecisionsTab.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/notebook/DecisionsTab.tsx frontend/src/notebook/DecisionsTab.test.tsx
git commit -m "feat(notebook): Decisions checklist tab component"
```

---

### Task 3: Enable Decisions tab in NotebookView

**Files:**
- Modify: `frontend/src/notebook/NotebookView.tsx`
- Test: `frontend/src/notebook/NotebookView.test.tsx`

**Interfaces:**
- Consumes: `DecisionsTab` (Task 2), `DecisionPayload` (Task 1); existing `useNotebook`, `useAuth`.

The current `NotebookView.tsx` (from Slice C) imports `GapsTab` and `GapPayload`, has a `TABS` array with the `decisions` entry at `ready: false`, derives `const gapsPayload = (reports?.gaps?.payload ?? null) as GapPayload | null;`, and has a `{tab === "gaps" && (...)}` render block ending the component. Apply these exact edits.

- [ ] **Step 1: Update the failing test**

Replace the entire contents of `frontend/src/notebook/NotebookView.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ isAdmin: false, email: null }) }));
vi.mock("../lib/hooks/useNotebook", () => ({
  useNotebook: () => ({
    timeline: null,
    reports: {},
    pending: [],
    error: null,
    busy: false,
    generateTimeline: vi.fn(),
    requestRefresh: vi.fn(),
  }),
}));

import { NotebookView } from "./NotebookView";

describe("NotebookView", () => {
  it("shows the banner and an enabled, switchable Gaps tab", () => {
    render(<NotebookView />);
    expect(screen.getByText(/The team writes the notebook/)).toBeTruthy();
    const gaps = screen.getByRole("button", { name: "Gaps" }) as HTMLButtonElement;
    expect(gaps.disabled).toBe(false);
    fireEvent.click(gaps);
    expect(screen.getByText(/No gap analysis yet/)).toBeTruthy();
  });

  it("has an enabled, switchable Decisions tab", () => {
    render(<NotebookView />);
    const decisions = screen.getByRole("button", { name: "Decisions" }) as HTMLButtonElement;
    expect(decisions.disabled).toBe(false);
    fireEvent.click(decisions);
    expect(screen.getByText(/No decision worksheet yet/)).toBeTruthy();
  });

  it("keeps Scaffold disabled (still coming soon)", () => {
    render(<NotebookView />);
    expect((screen.getByRole("button", { name: "Scaffold" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx`
Expected: FAIL (Decisions still disabled; no "No decision worksheet yet" text).

- [ ] **Step 3: Add the import**

In `frontend/src/notebook/NotebookView.tsx`, add after the `import { GapsTab } from "./GapsTab";` line:

```tsx
import { DecisionsTab } from "./DecisionsTab";
```

and change the types import line:

```tsx
import type { GapPayload } from "@weeklog/types";
```

to:

```tsx
import type { GapPayload, DecisionPayload } from "@weeklog/types";
```

- [ ] **Step 4: Enable the Decisions tab**

In the `TABS` array, change the decisions entry from:

```tsx
  { id: "decisions", label: "Decisions", ready: false, deterministic: false },
```

to:

```tsx
  { id: "decisions", label: "Decisions", ready: true, deterministic: false },
```

- [ ] **Step 5: Derive the decisions payload**

Immediately after the line:

```tsx
  const gapsPayload = (reports?.gaps?.payload ?? null) as GapPayload | null;
```

add:

```tsx
  const decisionsPayload = (reports?.decisions?.payload ?? null) as DecisionPayload | null;
```

- [ ] **Step 6: Render the Decisions tab**

Immediately after the closing of the gaps render block:

```tsx
      {tab === "gaps" &&
        (gapsPayload ? (
          <GapsTab payload={gapsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No gap analysis yet.</p>
        ))}
```

add:

```tsx
      {tab === "decisions" &&
        (decisionsPayload ? (
          <DecisionsTab payload={decisionsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No decision worksheet yet.</p>
        ))}
```

- [ ] **Step 7: Run the notebook frontend tests**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx src/notebook/DecisionsTab.test.tsx src/notebook/GapsTab.test.tsx src/notebook/TimelineTab.test.tsx`
Expected: PASS.

- [ ] **Step 8: Full verify**

Run: `npm run verify`
Expected: PASS (typecheck all workspaces, worker + frontend tests, frontend build).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/notebook/NotebookView.tsx frontend/src/notebook/NotebookView.test.tsx
git commit -m "feat(notebook): enable Decisions tab"
```

---

### Task 4: NOTEBOOK_PREP.md Decisions section

**Files:**
- Modify: `NOTEBOOK_PREP.md` (append a Decisions section)
- Test: none (docs); consistency-checked in Step 2

**Interfaces:**
- Consumes: the existing `/season`, `/coverage`, `/publish` endpoints and the `decisions` kind.

- [ ] **Step 1: Append the Decisions section**

Append to `NOTEBOOK_PREP.md` (after the Gaps report section):

```markdown
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
```

- [ ] **Step 2: Consistency check against the code**

Run: `grep -n "Decisions report\|\"decisions\"\|api/notebook/publish" NOTEBOOK_PREP.md`
Expected: the Decisions section header, the `"decisions"` kind, and the publish endpoint all present, matching the `decisions` value in `KINDS` in `worker/src/routes/notebook.ts`.

- [ ] **Step 3: Commit**

```bash
git add NOTEBOOK_PREP.md
git commit -m "docs(notebook): NOTEBOOK_PREP.md Decisions section"
```

---

## Deferred

- Scaffold tab + `ScaffoldPayload` (Slice E), reusing the same publish path, `/season`, `/coverage`, and runbook pattern.

## Self-Review notes

- Spec coverage: `DecisionPayload` type (Task 1), Decisions checklist tab (Task 2), NotebookView enable + render (Task 3), runbook section (Task 4). No worker tasks, matching the spec's "no worker changes" note.
- Type consistency: `DecisionsTab({ payload }: { payload: DecisionPayload })` consumed by NotebookView via `reports.decisions?.payload`. `DecisionMissing` keys (`why`/`numbers`/`alternatives`/`result`) match the `MISSING_LABEL` map and the runbook payload example.
- Reuse: the DecisionsTab includes the `Array.isArray` defensive guard learned from the Slice-C Gaps review; controls and publish path are reused unchanged.
