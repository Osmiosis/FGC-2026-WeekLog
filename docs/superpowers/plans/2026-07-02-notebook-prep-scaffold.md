# Notebook Prep (Slice E: Scaffold) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Scaffold worksheet tab: a DRAFT notebook skeleton with section headings, the team's verbatim logged words as raw material, and `[NEEDS: ...]` slots, plus a copy-raw-markdown action. Ships all four Notebook Prep tabs live.

**Architecture:** Reuses all prior infrastructure. The `scaffold` report kind is already supported end to end by the worker, so this slice adds only a shared `ScaffoldPayload` type, a `ScaffoldTab` component, the NotebookView wiring, and a runbook section. The report is authored offline by Claude Code and published via the existing secret-gated `/publish`.

**Tech Stack:** React 18 + Vite (frontend), TypeScript, vitest + jsdom.

## Global Constraints

- No em dashes anywhere in code, comments, tests, UI copy, or docs.
- No runtime LLM API; the Scaffold report is authored offline by Claude Code. Zero cost.
- `raw_material` is the team's verbatim logged words; `needs` only flag and ask, never inventing content. The output is deliberately un-submittable, marked DRAFT / NOT FOR SUBMISSION.
- Shared types live once in `@weeklog/types`, imported type-only by the frontend.
- No worker code changes in this slice (the `scaffold` kind is already handled generically).

---

### Task 1: ScaffoldPayload shared type

**Files:**
- Modify: `types/src/notebook.ts` (append types; widen `ReportPayload`)
- Test: none (types-only; verified by `npm run typecheck`)

**Interfaces:**
- Produces: `ScaffoldSection`, `ScaffoldPayload` from `@weeklog/types`; `ReportPayload` widened to `TimelinePayload | GapPayload | DecisionPayload | ScaffoldPayload`.

- [ ] **Step 1: Append the types**

Append to `types/src/notebook.ts`:

```ts
// Scaffold worksheet (AI-authored offline, published via /publish). Renders as a
// DRAFT outline: verbatim raw material plus [NEEDS: ...] slots. Never submittable.
export interface ScaffoldSection {
  heading: string;
  raw_material: string[]; // the team's own logged words, verbatim
  needs: string[]; // prompts for a human, rendered as [NEEDS: ...] slots
}
export interface ScaffoldPayload {
  draft_notice: string; // fixed NOT FOR SUBMISSION text
  sections: ScaffoldSection[];
}
```

- [ ] **Step 2: Widen the report payload union**

In `types/src/notebook.ts`, change:

```ts
export type ReportPayload = TimelinePayload | GapPayload | DecisionPayload;
```

to:

```ts
export type ReportPayload = TimelinePayload | GapPayload | DecisionPayload | ScaffoldPayload;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS for all three workspaces.

- [ ] **Step 4: Commit**

```bash
git add types/src/notebook.ts
git commit -m "feat(types): ScaffoldPayload contract for Notebook Prep slice E"
```

---

### Task 2: ScaffoldTab component

**Files:**
- Create: `frontend/src/notebook/ScaffoldTab.tsx`
- Test: `frontend/src/notebook/ScaffoldTab.test.tsx`

**Interfaces:**
- Consumes: `ScaffoldPayload` from `@weeklog/types`.
- Produces: `ScaffoldTab({ payload }: { payload: ScaffoldPayload })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/notebook/ScaffoldTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScaffoldTab } from "./ScaffoldTab";
import type { ScaffoldPayload } from "@weeklog/types";

const payload: ScaffoldPayload = {
  draft_notice: "DRAFT. NOT FOR SUBMISSION.",
  sections: [
    { heading: "Drivetrain", raw_material: ["Went with 4-wheel drivetrain"], needs: ["Why did 4-wheel win?"] },
  ],
};

describe("ScaffoldTab", () => {
  it("renders the draft banner, heading, raw material, and NEEDS slots", () => {
    render(<ScaffoldTab payload={payload} />);
    expect(screen.getByText(/NOT FOR SUBMISSION/)).toBeTruthy();
    expect(screen.getByText("Drivetrain")).toBeTruthy();
    expect(screen.getByText("Went with 4-wheel drivetrain")).toBeTruthy();
    expect(screen.getByText(/Why did 4-wheel win\?/)).toBeTruthy();
  });

  it("copies raw markdown to the clipboard", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ScaffoldTab payload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy raw markdown/ }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const md = writeText.mock.calls[0][0] as string;
    expect(md).toContain("## Drivetrain");
    expect(md).toContain("- Went with 4-wheel drivetrain");
    expect(md).toContain("[NEEDS: Why did 4-wheel win?]");
  });

  it("shows the empty state for no sections", () => {
    render(<ScaffoldTab payload={{ draft_notice: "x", sections: [] }} />);
    expect(screen.getByText(/No scaffold yet/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/ScaffoldTab.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `frontend/src/notebook/ScaffoldTab.tsx`:

```tsx
import type { ScaffoldPayload } from "@weeklog/types";

const DEFAULT_NOTICE = "DRAFT. NOT FOR SUBMISSION. The team writes the notebook.";

// Assemble the scaffold into raw markdown for transfer into the real notebook doc.
function toMarkdown(payload: ScaffoldPayload): string {
  const lines: string[] = [payload.draft_notice || DEFAULT_NOTICE, ""];
  for (const s of payload.sections) {
    lines.push(`## ${s.heading}`);
    for (const r of s.raw_material) lines.push(`- ${r}`);
    for (const n of s.needs) lines.push(`[NEEDS: ${n}]`);
    lines.push("");
  }
  return lines.join("\n");
}

// DRAFT worksheet: verbatim raw material under each heading, with amber NEEDS
// slots a human must fill. Guarded so a malformed published payload cannot throw.
export function ScaffoldTab({ payload }: { payload: ScaffoldPayload }) {
  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No scaffold yet.</p>;
  }
  const notice = payload.draft_notice || DEFAULT_NOTICE;
  const copy = () => {
    void navigator.clipboard.writeText(toMarkdown(payload));
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <span
          className="mono-label"
          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--bad)", color: "var(--bad)", fontWeight: 600 }}
        >
          {notice}
        </span>
        <button className="btn btn-sm" onClick={copy} style={{ marginLeft: "auto" }}>Copy raw markdown</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {payload.sections.map((s, i) => (
          <div key={i} className="card card-pad">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{s.heading}</div>
            {s.raw_material.length > 0 && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 4 }}>
                {s.raw_material.map((r, j) => (
                  <li key={j} style={{ fontSize: 14 }}>{r}</li>
                ))}
              </ul>
            )}
            {s.needs.length > 0 && (
              <div style={{ display: "grid", gap: 4 }}>
                {s.needs.map((n, j) => (
                  <div key={j} className="mono-label" style={{ color: "var(--warn)" }}>NEEDS: {n}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/ScaffoldTab.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/notebook/ScaffoldTab.tsx frontend/src/notebook/ScaffoldTab.test.tsx
git commit -m "feat(notebook): Scaffold DRAFT worksheet tab with copy-markdown"
```

---

### Task 3: Enable Scaffold tab in NotebookView

**Files:**
- Modify: `frontend/src/notebook/NotebookView.tsx`
- Test: `frontend/src/notebook/NotebookView.test.tsx`

**Interfaces:**
- Consumes: `ScaffoldTab` (Task 2), `ScaffoldPayload` (Task 1); existing `useNotebook`, `useAuth`.

The current `NotebookView.tsx` (after Slice D) imports `GapsTab` and `DecisionsTab`, has `import type { GapPayload, DecisionPayload } from "@weeklog/types";`, a `TABS` array with the `scaffold` entry at `ready: false`, derives `gapsPayload` and `decisionsPayload`, and has `{tab === "gaps" && (...)}` and `{tab === "decisions" && (...)}` render blocks. Apply these exact edits.

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

  it("has all four tabs enabled and none disabled", () => {
    render(<NotebookView />);
    for (const name of ["Timeline", "Gaps", "Decisions", "Scaffold"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("switches to Scaffold and shows its empty state", () => {
    render(<NotebookView />);
    fireEvent.click(screen.getByRole("button", { name: "Scaffold" }));
    expect(screen.getByText(/No scaffold yet/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx`
Expected: FAIL (Scaffold still disabled; no "No scaffold yet" text).

- [ ] **Step 3: Add the import**

In `frontend/src/notebook/NotebookView.tsx`, add after the `import { DecisionsTab } from "./DecisionsTab";` line:

```tsx
import { ScaffoldTab } from "./ScaffoldTab";
```

and change the types import line:

```tsx
import type { GapPayload, DecisionPayload } from "@weeklog/types";
```

to:

```tsx
import type { GapPayload, DecisionPayload, ScaffoldPayload } from "@weeklog/types";
```

- [ ] **Step 4: Enable the Scaffold tab**

In the `TABS` array, change the scaffold entry from:

```tsx
  { id: "scaffold", label: "Scaffold", ready: false, deterministic: false },
```

to:

```tsx
  { id: "scaffold", label: "Scaffold", ready: true, deterministic: false },
```

- [ ] **Step 5: Derive the scaffold payload**

Immediately after the line:

```tsx
  const decisionsPayload = (reports?.decisions?.payload ?? null) as DecisionPayload | null;
```

add:

```tsx
  const scaffoldPayload = (reports?.scaffold?.payload ?? null) as ScaffoldPayload | null;
```

- [ ] **Step 6: Render the Scaffold tab**

Immediately after the closing of the decisions render block:

```tsx
      {tab === "decisions" &&
        (decisionsPayload ? (
          <DecisionsTab payload={decisionsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No decision worksheet yet.</p>
        ))}
```

add:

```tsx
      {tab === "scaffold" &&
        (scaffoldPayload ? (
          <ScaffoldTab payload={scaffoldPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No scaffold yet.</p>
        ))}
```

- [ ] **Step 7: Run the notebook frontend tests**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx src/notebook/ScaffoldTab.test.tsx src/notebook/DecisionsTab.test.tsx src/notebook/GapsTab.test.tsx src/notebook/TimelineTab.test.tsx`
Expected: PASS.

- [ ] **Step 8: Full verify**

Run: `npm run verify`
Expected: PASS (typecheck all workspaces, worker + frontend tests, frontend build).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/notebook/NotebookView.tsx frontend/src/notebook/NotebookView.test.tsx
git commit -m "feat(notebook): enable Scaffold tab (all four tabs live)"
```

---

### Task 4: NOTEBOOK_PREP.md Scaffold section

**Files:**
- Modify: `NOTEBOOK_PREP.md` (append a Scaffold section)
- Test: none (docs); consistency-checked in Step 2

**Interfaces:**
- Consumes: the existing `/season`, `/publish` endpoints and the `scaffold` kind.

- [ ] **Step 1: Append the Scaffold section**

Append to `NOTEBOOK_PREP.md` (after the Decisions report section):

```markdown
## Scaffold report

1. Fetch the inputs (public reads, no auth): `GET {BASE}/api/notebook/season`. Also read the already
   published gaps and decisions from `GET {BASE}/api/notebook/reports` for context.
2. Read `PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md` so the section structure follows what judges expect.
3. Produce a `ScaffoldPayload`: a notebook SKELETON with `sections` keyed by subsystem or
   design-process stage. For each section, `raw_material` is the team's OWN logged words, verbatim
   (never rewritten), and `needs` is a list of prompts marking every place a human must add
   reasoning, math, or narrative (phrased as questions, never answered). `draft_notice` is the fixed
   NOT FOR SUBMISSION text. Never invent content and never write the notebook prose.
   Shape:
   `{ "draft_notice": "DRAFT. NOT FOR SUBMISSION. The team writes the notebook.", "sections": [ { "heading": "Drivetrain", "raw_material": ["Went with 4-wheel drivetrain (2 omni front, 2 traction back)"], "needs": ["Why did 4-wheel win over 6-wheel?", "What were the numbers behind the choice?"] } ] }`
4. Publish it: `POST {BASE}/api/notebook/publish`, header `X-Notebook-Secret: {the secret}`, body
   `{ "kind": "scaffold", "payload": { ...the ScaffoldPayload... } }`. A 200 means the Scaffold tab
   now shows the DRAFT worksheet and pending scaffold requests are marked fulfilled.

Rules: same as the other reports. Raw material stays verbatim, needs only flag and ask, no invented
facts or numbers, the output is never a submittable notebook, no em dashes.
```

- [ ] **Step 2: Consistency check against the code**

Run: `grep -n "Scaffold report\|\"scaffold\"\|api/notebook/publish" NOTEBOOK_PREP.md`
Expected: the Scaffold section header, the `"scaffold"` kind, and the publish endpoint all present, matching the `scaffold` value in `KINDS` in `worker/src/routes/notebook.ts`.

- [ ] **Step 3: Commit**

```bash
git add NOTEBOOK_PREP.md
git commit -m "docs(notebook): NOTEBOOK_PREP.md Scaffold section"
```

---

## Completion

With this slice, all four Notebook Prep report kinds (timeline, gaps, decisions, scaffold) are built and live, and `NOTEBOOK_PREP.md` documents each. The pipeline v1 is complete. PRD-deferred items (judge-question rehearsal, notebook health over time, DOCX export, subsystem-tagging media at upload) remain out of scope.

## Self-Review notes

- Spec coverage: `ScaffoldPayload` type (Task 1), Scaffold worksheet tab with copy-markdown (Task 2), NotebookView enable + render (Task 3), runbook section (Task 4). No worker tasks, matching the spec's "no worker changes" note.
- Type consistency: `ScaffoldTab({ payload }: { payload: ScaffoldPayload })` consumed by NotebookView via `reports.scaffold?.payload`. `ScaffoldPayload.sections[].{heading,raw_material,needs}` and `draft_notice` used identically in the component, the `toMarkdown` helper, the test, and the runbook example.
- Reuse: the ScaffoldTab carries the `Array.isArray` defensive guard used by the Gaps and Decisions tabs; controls and publish path are reused unchanged.
