# Notebook Prep (Slice C: Gaps + Reasoning/Publish Infra) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first AI-reasoning report (Gaps) plus the shared offline produce-and-publish infrastructure: deterministic `/season` and `/coverage` read endpoints, a secret-gated `/publish` write-back route, a Gaps RAG-card tab, and the `NOTEBOOK_PREP.md` runbook Claude Code follows.

**Architecture:** Deterministic data (season dump, coverage stats) is Worker-computed and served for the pipeline to read. Claude Code (run by the operator) reasons over that plus the FGC reference brief, authors a `GapPayload`, and POSTs it to a secret-gated write-back route that upserts the report by kind and fulfils pending requests. The frontend renders the published gaps as RAG cards. Reuses the Slice-B `notebook_reports`/`notebook_requests` tables, the `useNotebook` hook, and the Notebook Prep view.

**Tech Stack:** Cloudflare Workers + Hono + D1 (worker), React 18 + Vite (frontend), TypeScript, vitest, better-sqlite3 test shim.

## Global Constraints

- No em dashes anywhere in code, comments, tests, UI copy, or docs.
- No runtime LLM API calls; the only AI is Claude Code run by the operator. Zero ongoing cost.
- Reasoning outputs are prompts and observations for a human, never finished notebook prose, never invented facts or numbers.
- Photos are metadata only (caption, kind, date); never read image bytes.
- IDs `crypto.randomUUID()`, timestamps `new Date().toISOString()`.
- Shared types live once in `@weeklog/types` (`types/src/notebook.ts`), imported type-only by both apps.
- Subsystem taxonomy is the `committees` table; null-subsystem submissions bucket to `Uncategorized`.
- Content submission kinds: `accomplishment`, `failure`, `build_need`, `performance_goal`, `note`.
- Publish is a machine-called route gated by the `X-Notebook-Secret` header matching the `NOTEBOOK_PUBLISH_SECRET` Worker secret. It is not browser-called, so no CORS change is needed.

---

### Task 1: Shared types for gaps, coverage, and season export

**Files:**
- Modify: `types/src/notebook.ts` (append new types; widen `ReportPayload`)
- Test: none (types-only; verified by `npm run typecheck`)

**Interfaces:**
- Produces: `GapStatus`, `GapCriterion`, `GapPayload`, `CoverageSubsystem`, `CoverageStats`, `SeasonExport` from `@weeklog/types`; `ReportPayload` widened to `TimelinePayload | GapPayload`.

- [ ] **Step 1: Append the new types**

Append to `types/src/notebook.ts`:

```ts
// Gap analysis (AI-authored offline, published via /publish). Renders as RAG cards.
export type GapStatus = "strong" | "thin" | "missing";
export interface GapCriterion {
  criterion: string; // e.g. "Trade-off analysis"
  status: GapStatus; // strong=green, thin=amber, missing=red
  finding: string; // short, plain-language
  suggestions: string[]; // concrete prompts for a human, never written content
  evidence_refs?: { date: string; subsystem: string }[];
}
export interface GapPayload {
  criteria: GapCriterion[];
}

// Deterministic coverage stats (Worker-computed) that the reasoning interprets.
export interface CoverageSubsystem {
  name: string;
  entries: number;
  failures: number;
  buildNeedsOpen: number;
  buildNeedsResolved: number;
  numericEntries: number; // entries whose content contains a digit
}
export interface CoverageStats {
  subsystems: CoverageSubsystem[];
  photos: { total: number; byKind: Record<string, number> };
  spread: { firstDate: string | null; lastDate: string | null; meetingCount: number; largestGapDays: number };
  totals: { submissions: number; failures: number; numericEntries: number };
}

// Normalized season dump the pipeline reads. Media is metadata only, no bytes.
export interface SeasonExport {
  meetingDays: { id: string; date: string; title: string | null }[];
  submissions: { date: string; subsystem: string | null; kind: string; content: string | null; created_by: string | null }[];
  attendance: { date: string; present: string[] }[];
  deadlines: { title: string; description: string | null; category: string | null; due_date: string; status: string | null }[];
  media: { date: string | null; subsystem: string | null; caption: string | null; kind: string | null; onMeetingDay: boolean }[];
}
```

- [ ] **Step 2: Widen the report payload union**

In `types/src/notebook.ts`, change the existing line:

```ts
export type ReportPayload = TimelinePayload;
```

to:

```ts
export type ReportPayload = TimelinePayload | GapPayload;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS for all three workspaces.

- [ ] **Step 4: Commit**

```bash
git add types/src/notebook.ts
git commit -m "feat(types): gap/coverage/season contracts for Notebook Prep slice C"
```

---

### Task 2: GET /coverage (deterministic stats)

**Files:**
- Modify: `worker/src/routes/notebook.ts` (add `buildCoverage` helper + route)
- Test: `worker/test/notebook.test.ts`

**Interfaces:**
- Consumes: `CoverageStats` from `@weeklog/types`; the `notebook` router.
- Produces: `GET /api/notebook/coverage` returning `CoverageStats`.

- [ ] **Step 1: Write the failing test**

Append inside the `describe("notebook prep", ...)` block in `worker/test/notebook.test.ts`. Reuse the `seedSeason` helper added in Slice B (it creates a day 2026-07-07 with Shooter accomplishment, Climber failure, a null-subsystem note, and one photo). This test adds a build-need with a number and checks counts:

```ts
  it("coverage counts entries, failures, build-needs, numerics, and photos", async () => {
    const dayId = await seedSeason();
    // A numeric build-need on Shooter (open by default).
    await app.request(
      `/api/meeting-days/${dayId}/submissions`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "build_need", subsystem: "Shooter", content: "Need 4 more 80mm wheels" }) },
      env as never
    );

    const res = await app.request("/api/notebook/coverage", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const cov = (await res.json()) as {
      subsystems: { name: string; entries: number; failures: number; buildNeedsOpen: number; numericEntries: number }[];
      photos: { total: number; byKind: Record<string, number> };
      totals: { submissions: number; failures: number; numericEntries: number };
    };
    const shooter = cov.subsystems.find((s) => s.name === "Shooter")!;
    expect(shooter.entries).toBe(2); // accomplishment + build_need
    expect(shooter.buildNeedsOpen).toBe(1);
    expect(shooter.numericEntries).toBe(1); // "Need 4 more..." contains a digit
    expect(cov.subsystems.find((s) => s.name === "Climber")!.failures).toBe(1);
    expect(cov.subsystems.some((s) => s.name === "Uncategorized")).toBe(true); // the null-subsystem note
    expect(cov.photos.total).toBe(1);
    expect(cov.totals.failures).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (route `/coverage` returns 404).

- [ ] **Step 3: Implement buildCoverage and the route**

Add the `CoverageStats`, `CoverageSubsystem` types to the import line in `worker/src/routes/notebook.ts` (extend the existing `import type { ... } from "@weeklog/types";`). Then add the helper and route (place the helper near `buildTimeline`, the route after the requests routes):

```ts
// Deterministic coverage numbers the reasoning step interprets. Never invented:
// straight counts over the logged submissions and media.
async function buildCoverage(env: Env): Promise<CoverageStats> {
  const committees = (
    await env.DB.prepare("SELECT name FROM committees ORDER BY sort_order, name").all<{ name: string }>()
  ).results.map((r) => r.name);

  const subs = (
    await env.DB.prepare(
      `SELECT subsystem, kind, content, resolved FROM submissions
       WHERE kind IN ('accomplishment','failure','build_need','performance_goal','note')`
    ).all<{ subsystem: string | null; kind: string; content: string | null; resolved: number }>()
  ).results;

  const map = new Map<string, CoverageSubsystem>();
  const ensure = (name: string) => {
    let x = map.get(name);
    if (!x) {
      x = { name, entries: 0, failures: 0, buildNeedsOpen: 0, buildNeedsResolved: 0, numericEntries: 0 };
      map.set(name, x);
    }
    return x;
  };
  let totalFailures = 0;
  let totalNumeric = 0;
  for (const s of subs) {
    const x = ensure(s.subsystem ?? "Uncategorized");
    x.entries++;
    if (s.kind === "failure") {
      x.failures++;
      totalFailures++;
    }
    if (s.kind === "build_need") {
      if (s.resolved) x.buildNeedsResolved++;
      else x.buildNeedsOpen++;
    }
    if (s.content && /\d/.test(s.content)) {
      x.numericEntries++;
      totalNumeric++;
    }
  }
  const ordered: string[] = [];
  for (const n of committees) if (map.has(n)) ordered.push(n);
  for (const n of map.keys()) if (!ordered.includes(n)) ordered.push(n);
  const subsystems = ordered.map((n) => map.get(n)!);

  const media = (await env.DB.prepare("SELECT kind FROM media").all<{ kind: string | null }>()).results;
  const byKind: Record<string, number> = {};
  for (const m of media) {
    const k = m.kind ?? "unknown";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }

  const days = (
    await env.DB.prepare("SELECT date FROM meeting_days ORDER BY date").all<{ date: string }>()
  ).results.map((r) => r.date);
  let largestGapDays = 0;
  for (let i = 1; i < days.length; i++) {
    const d0 = new Date(days[i - 1] + "T00:00:00Z").getTime();
    const d1 = new Date(days[i] + "T00:00:00Z").getTime();
    const gap = Math.round((d1 - d0) / 86400000);
    if (gap > largestGapDays) largestGapDays = gap;
  }

  return {
    subsystems,
    photos: { total: media.length, byKind },
    spread: { firstDate: days[0] ?? null, lastDate: days[days.length - 1] ?? null, meetingCount: days.length, largestGapDays },
    totals: { submissions: subs.length, failures: totalFailures, numericEntries: totalNumeric },
  };
}

notebook.get("/coverage", requireUser, async (c) => c.json(await buildCoverage(c.env)));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/notebook.ts worker/test/notebook.test.ts
git commit -m "feat(notebook): GET /coverage deterministic stats"
```

---

### Task 3: GET /season (normalized dump)

**Files:**
- Modify: `worker/src/routes/notebook.ts` (add `buildSeason` helper + route)
- Test: `worker/test/notebook.test.ts`

**Interfaces:**
- Consumes: `SeasonExport` from `@weeklog/types`.
- Produces: `GET /api/notebook/season` returning `SeasonExport`.

- [ ] **Step 1: Write the failing test**

Append inside the describe block in `worker/test/notebook.test.ts`:

```ts
  it("season export returns normalized data with media metadata only", async () => {
    await seedSeason();
    const res = await app.request("/api/notebook/season", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const season = (await res.json()) as {
      meetingDays: { date: string }[];
      submissions: { date: string; kind: string; content: string | null }[];
      media: { caption: string | null; kind: string | null; onMeetingDay: boolean }[];
    };
    expect(season.meetingDays.some((d) => d.date === "2026-07-07")).toBe(true);
    expect(season.submissions.some((s) => s.content === "Shooter tuned")).toBe(true); // verbatim
    expect(season.media.length).toBe(1);
    expect(season.media[0].onMeetingDay).toBe(true);
    expect(season.media[0]).not.toHaveProperty("r2_key"); // metadata only, no bytes/keys
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (route `/season` returns 404).

- [ ] **Step 3: Implement buildSeason and the route**

Add `SeasonExport` to the `@weeklog/types` import line. Add the helper and route in `worker/src/routes/notebook.ts`:

```ts
// Normalized season dump for the offline reasoning pipeline. Media is metadata
// only (caption, kind, date) so no image bytes ever reach a reasoning step.
async function buildSeason(env: Env): Promise<SeasonExport> {
  const meetingDays = (
    await env.DB.prepare("SELECT id, date, title FROM meeting_days ORDER BY date").all<{ id: string; date: string; title: string | null }>()
  ).results;

  const submissions = (
    await env.DB.prepare(
      `SELECT md.date, s.subsystem, s.kind, s.content, s.created_by
       FROM submissions s JOIN meeting_days md ON md.id = s.meeting_day_id
       ORDER BY md.date, s.created_at`
    ).all<{ date: string; subsystem: string | null; kind: string; content: string | null; created_by: string | null }>()
  ).results;

  const att = (
    await env.DB.prepare(
      `SELECT md.date, m.name FROM attendance a
       JOIN members m ON m.id = a.member_id
       JOIN meeting_days md ON md.id = a.meeting_day_id
       WHERE a.present = 1 ORDER BY md.date, m.name`
    ).all<{ date: string; name: string }>()
  ).results;
  const attByDate = new Map<string, string[]>();
  for (const r of att) {
    const l = attByDate.get(r.date);
    if (l) l.push(r.name);
    else attByDate.set(r.date, [r.name]);
  }
  const attendance = [...attByDate.entries()].map(([date, present]) => ({ date, present }));

  const deadlines = (
    await env.DB.prepare(
      "SELECT title, description, category, due_date, status FROM deadlines ORDER BY due_date"
    ).all<{ title: string; description: string | null; category: string | null; due_date: string; status: string | null }>()
  ).results;

  const mediaRows = (
    await env.DB.prepare(
      `SELECT m.subsystem, m.caption, m.kind, md.date AS mdate, m.meeting_day_id
       FROM media m LEFT JOIN meeting_days md ON md.id = m.meeting_day_id`
    ).all<{ subsystem: string | null; caption: string | null; kind: string | null; mdate: string | null; meeting_day_id: string | null }>()
  ).results;
  const media = mediaRows.map((m) => ({
    date: m.mdate,
    subsystem: m.subsystem,
    caption: m.caption,
    kind: m.kind,
    onMeetingDay: m.meeting_day_id != null,
  }));

  return { meetingDays, submissions, attendance, deadlines, media };
}

notebook.get("/season", requireUser, async (c) => c.json(await buildSeason(c.env)));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/notebook.ts worker/test/notebook.test.ts
git commit -m "feat(notebook): GET /season normalized dump"
```

---

### Task 4: POST /publish + saveReport helper + secret binding

**Files:**
- Modify: `worker/src/bindings.ts` (add `NOTEBOOK_PUBLISH_SECRET?`)
- Modify: `worker/src/routes/notebook.ts` (extract `saveReport`, refactor `generate/timeline`, add `/publish`)
- Test: `worker/test/notebook.test.ts`

**Interfaces:**
- Consumes: `ReportKind` from `@weeklog/types`; `KINDS` constant.
- Produces: `saveReport(env, kind, payload)` helper; `POST /api/notebook/publish` (secret-gated).

- [ ] **Step 1: Add the secret to Env**

In `worker/src/bindings.ts`, add to the `Env` interface (near the other optional config):

```ts
  // Shared secret for the offline pipeline's write-back to /api/notebook/publish.
  NOTEBOOK_PUBLISH_SECRET?: string;
```

- [ ] **Step 2: Write the failing tests**

Append inside the describe block in `worker/test/notebook.test.ts`:

```ts
  const GAPS = { kind: "gaps", payload: { criteria: [{ criterion: "Trade-off analysis", status: "thin", finding: "Only 1 decision documented", suggestions: ["Write up the wheel change"] }] } };

  it("publish is 503 when the secret is not configured", async () => {
    const res = await app.request(
      "/api/notebook/publish",
      { method: "POST", headers: { "X-Notebook-Secret": "whatever", "Content-Type": "application/json" }, body: JSON.stringify(GAPS) },
      env as never
    );
    expect(res.status).toBe(503);
  });

  it("publish rejects a missing or wrong secret", async () => {
    env.NOTEBOOK_PUBLISH_SECRET = "s3cret";
    const noHeader = await app.request(
      "/api/notebook/publish",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(GAPS) },
      env as never
    );
    expect(noHeader.status).toBe(401);
    const wrong = await app.request(
      "/api/notebook/publish",
      { method: "POST", headers: { "X-Notebook-Secret": "nope", "Content-Type": "application/json" }, body: JSON.stringify(GAPS) },
      env as never
    );
    expect(wrong.status).toBe(401);
  });

  it("publish with the right secret upserts the report and fulfils pending requests", async () => {
    env.NOTEBOOK_PUBLISH_SECRET = "s3cret";
    await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "gaps" }) },
      env as never
    );
    const res = await app.request(
      "/api/notebook/publish",
      { method: "POST", headers: { "X-Notebook-Secret": "s3cret", "Content-Type": "application/json" }, body: JSON.stringify(GAPS) },
      env as never
    );
    expect(res.status).toBe(200);

    const map = (await (await app.request("/api/notebook/reports", { headers: MEMBER }, env as never)).json()) as {
      gaps?: { payload: { criteria: { criterion: string }[] } };
    };
    expect(map.gaps?.payload.criteria[0].criterion).toBe("Trade-off analysis");
    const pending = (await (await app.request("/api/notebook/requests", { headers: ADMIN }, env as never)).json()) as unknown[];
    expect(pending).toEqual([]); // gaps request fulfilled
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (route `/publish` returns 404).

- [ ] **Step 4: Extract saveReport, refactor generate/timeline, add /publish**

In `worker/src/routes/notebook.ts`, add the helper (place it above the `generate/timeline` route):

```ts
// Upsert the single snapshot row for a kind and fulfil that kind's pending
// requests. Shared by the deterministic generate routes and the offline publish.
async function saveReport(env: Env, kind: ReportKind, payload: unknown): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO notebook_reports (id, kind, generated_at, payload)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET id = excluded.id, generated_at = excluded.generated_at, payload = excluded.payload`
  )
    .bind(crypto.randomUUID(), kind, now, JSON.stringify(payload))
    .run();
  await env.DB.prepare(
    "UPDATE notebook_requests SET status = 'fulfilled', fulfilled_at = ? WHERE kind = ? AND status = 'pending'"
  )
    .bind(now, kind)
    .run();
}
```

Replace the existing `generate/timeline` route body with:

```ts
notebook.post("/generate/timeline", requireAdmin, async (c) => {
  const payload = await buildTimeline(c.env);
  await saveReport(c.env, "timeline", payload);
  return c.json(payload);
});
```

Add the publish route:

```ts
// Offline write-back for reports authored by Claude Code (gaps, decisions,
// scaffold). Gated by a shared secret, not user auth: it is machine-called by the
// pipeline, never the browser. Accepts any kind so later reasoning tabs reuse it.
notebook.post("/publish", async (c) => {
  const secret = c.env.NOTEBOOK_PUBLISH_SECRET;
  if (!secret) return c.json({ error: "publish not configured" }, 503);
  if (c.req.header("X-Notebook-Secret") !== secret) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ kind?: string; payload?: unknown }>();
  if (!body.kind || !KINDS.includes(body.kind as ReportKind)) return c.json({ error: "unknown kind" }, 400);
  if (body.payload === undefined || body.payload === null) return c.json({ error: "payload required" }, 400);
  await saveReport(c.env, body.kind as ReportKind, body.payload);
  return c.json({ ok: true });
});
```

- [ ] **Step 5: Run the notebook tests, then the full worker suite**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS (including the unchanged generate/timeline tests, proving the refactor is behavior-preserving).

Run: `npm run test --workspace @weeklog/worker`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add worker/src/bindings.ts worker/src/routes/notebook.ts worker/test/notebook.test.ts
git commit -m "feat(notebook): secret-gated /publish write-back + shared saveReport"
```

---

### Task 5: Gaps tab component

**Files:**
- Create: `frontend/src/notebook/GapsTab.tsx`
- Test: `frontend/src/notebook/GapsTab.test.tsx`

**Interfaces:**
- Consumes: `GapPayload`, `GapStatus` from `@weeklog/types`.
- Produces: `GapsTab({ payload }: { payload: GapPayload })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/notebook/GapsTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GapsTab } from "./GapsTab";
import type { GapPayload } from "@weeklog/types";

const payload: GapPayload = {
  criteria: [
    { criterion: "Trade-off analysis", status: "thin", finding: "Only 1 decision documented", suggestions: ["Write up the wheel change", "Add the numbers"] },
    { criterion: "Design iteration photos", status: "missing", finding: "Shooter has builds but no sketches", suggestions: [] },
  ],
};

describe("GapsTab", () => {
  it("renders one card per criterion with finding and suggestions", () => {
    render(<GapsTab payload={payload} />);
    expect(screen.getByText("Trade-off analysis")).toBeTruthy();
    expect(screen.getByText("Only 1 decision documented")).toBeTruthy();
    expect(screen.getByText("Write up the wheel change")).toBeTruthy();
    expect(screen.getByText("Design iteration photos")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/GapsTab.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `frontend/src/notebook/GapsTab.tsx`:

```tsx
import type { GapPayload, GapStatus } from "@weeklog/types";

// RAG legible: strong good, thin needs work, missing absent.
const STATUS_COLOR: Record<GapStatus, string> = {
  strong: "var(--ok)",
  thin: "var(--warn)",
  missing: "var(--bad)",
};
const STATUS_LABEL: Record<GapStatus, string> = {
  strong: "Strong",
  thin: "Thin",
  missing: "Missing",
};

export function GapsTab({ payload }: { payload: GapPayload }) {
  if (payload.criteria.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No criteria in this report.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {payload.criteria.map((c, i) => (
        <div key={i} className="card card-pad" style={{ borderLeft: `3px solid ${STATUS_COLOR[c.status]}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 50, background: STATUS_COLOR[c.status], flex: "none" }} />
            <span style={{ fontWeight: 600 }}>{c.criterion}</span>
            <span className="mono-label" style={{ marginLeft: "auto", color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
          </div>
          <div style={{ fontSize: 14.5, marginBottom: c.suggestions.length ? 8 : 0 }}>{c.finding}</div>
          {c.suggestions.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {c.suggestions.map((s, j) => (
                <li key={j} className="mono-label" style={{ color: "var(--fg-dim)" }}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/GapsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/notebook/GapsTab.tsx frontend/src/notebook/GapsTab.test.tsx
git commit -m "feat(notebook): Gaps RAG-card tab component"
```

---

### Task 6: Enable Gaps tab + tab-aware controls in NotebookView

**Files:**
- Modify: `frontend/src/notebook/NotebookView.tsx`
- Test: `frontend/src/notebook/NotebookView.test.tsx`

**Interfaces:**
- Consumes: `GapsTab` (Task 5); existing `useNotebook`, `useAuth`, `fmtDate`.

- [ ] **Step 1: Update the failing test**

Replace the contents of `frontend/src/notebook/NotebookView.test.tsx` with (the Gaps tab is now enabled, so the old "Gaps is disabled" assertion must change):

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

  it("keeps Decisions disabled (still coming soon)", () => {
    render(<NotebookView />);
    expect((screen.getByRole("button", { name: "Decisions" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx`
Expected: FAIL (Gaps still disabled; no "No gap analysis yet" text).

- [ ] **Step 3: Rewrite NotebookView with tab-aware controls**

Replace the entire contents of `frontend/src/notebook/NotebookView.tsx`:

```tsx
import { useState } from "react";
import { useNotebook } from "../lib/hooks/useNotebook";
import { useAuth } from "../auth/AuthProvider";
import { TimelineTab } from "./TimelineTab";
import { GapsTab } from "./GapsTab";
import { fmtDate } from "../ui/primitives";
import type { GapPayload } from "@weeklog/types";

type NbTab = "timeline" | "gaps" | "decisions" | "scaffold";
// deterministic tabs get an in-app Generate button; reasoning tabs refresh via
// the NOTEBOOK_PREP.md pipeline, so they only expose request/pending.
const TABS: { id: NbTab; label: string; ready: boolean; deterministic: boolean }[] = [
  { id: "timeline", label: "Timeline", ready: true, deterministic: true },
  { id: "gaps", label: "Gaps", ready: true, deterministic: false },
  { id: "decisions", label: "Decisions", ready: false, deterministic: false },
  { id: "scaffold", label: "Scaffold", ready: false, deterministic: false },
];

export function NotebookView() {
  const { isAdmin } = useAuth();
  const { timeline, reports, pending, error, busy, generateTimeline, requestRefresh } = useNotebook();
  const [tab, setTab] = useState<NbTab>("timeline");

  const cfg = TABS.find((t) => t.id === tab)!;
  const pendingCount = pending.find((p) => p.kind === tab)?.count ?? 0;
  const generatedAt = reports?.[tab]?.generated_at ?? null;
  const gapsPayload = (reports?.gaps?.payload ?? null) as GapPayload | null;

  return (
    <div>
      <div className="card card-pad" style={{ borderLeft: "3px solid var(--maroon-bright)", marginBottom: 18 }}>
        <p className="mono-label" style={{ lineHeight: 1.6 }}>
          Draft raw material and audit for the team's engineering notebook. Not a notebook. The team writes the notebook.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className="btn btn-ghost btn-sm"
            disabled={!t.ready}
            onClick={() => t.ready && setTab(t.id)}
            style={{ borderBottom: tab === t.id ? "2px solid var(--maroon-bright)" : "2px solid transparent", opacity: t.ready ? 1 : 0.4 }}
          >
            {t.label}
            {!t.ready && <span aria-hidden="true"> (soon)</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {isAdmin && cfg.deterministic ? (
          <button className="btn btn-sm" disabled={busy} onClick={generateTimeline}>
            {busy ? "Generating..." : "Generate / refresh timelines"}
          </button>
        ) : !isAdmin ? (
          <button className="btn btn-sm" onClick={() => requestRefresh(tab)}>Request refresh</button>
        ) : null}
        {isAdmin && pendingCount > 0 && (
          <span className="mono-label" style={{ color: "var(--warn)" }}>{pendingCount} refresh requested</span>
        )}
        {isAdmin && !cfg.deterministic && (
          <span className="mono-label" style={{ color: "var(--fg-faint)" }}>Refresh by running NOTEBOOK_PREP.md in Claude Code.</span>
        )}
        <span className="mono-label" style={{ color: "var(--fg-faint)" }}>
          {generatedAt ? `Last updated ${fmtDate(generatedAt)}` : "Not generated yet"}
        </span>
        {error && <p className="mono-label" style={{ color: "var(--bad)" }}>{error}</p>}
      </div>

      {tab === "timeline" &&
        (timeline ? (
          <TimelineTab payload={timeline} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>
            No timeline yet. {isAdmin ? "Click Generate to build it." : "Ask an admin to generate it."}
          </p>
        ))}

      {tab === "gaps" &&
        (gapsPayload ? (
          <GapsTab payload={gapsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No gap analysis yet.</p>
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the notebook frontend tests**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx src/notebook/GapsTab.test.tsx src/notebook/TimelineTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verify**

Run: `npm run verify`
Expected: PASS (typecheck all workspaces, worker + frontend tests, frontend build).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/notebook/NotebookView.tsx frontend/src/notebook/NotebookView.test.tsx
git commit -m "feat(notebook): enable Gaps tab with tab-aware controls"
```

---

### Task 7: NOTEBOOK_PREP.md runbook (Gaps section)

**Files:**
- Create: `NOTEBOOK_PREP.md` (repo root)
- Test: none (docs); consistency-checked in Step 2

**Interfaces:**
- Consumes: the endpoints and secret from Tasks 2-4 (paths, header name, kind value).

- [ ] **Step 1: Write the runbook**

Create `NOTEBOOK_PREP.md` at the repo root:

```markdown
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
```

- [ ] **Step 2: Consistency check against the code**

Verify the runbook's paths, header, and kind match the implementation.

Run: `grep -n "api/notebook/season\|api/notebook/coverage\|api/notebook/publish\|X-Notebook-Secret\|\"gaps\"" NOTEBOOK_PREP.md`
Expected: all four endpoints/header present, matching `worker/src/routes/notebook.ts` (routes `/season`, `/coverage`, `/publish`; header `X-Notebook-Secret`; kind `gaps`).

- [ ] **Step 3: Commit**

```bash
git add NOTEBOOK_PREP.md
git commit -m "docs(notebook): NOTEBOOK_PREP.md runbook, Gaps section"
```

---

## Deferred (seams left for later slices)

- Decisions tab + `DecisionPayload` (Slice D) and Scaffold tab + `ScaffoldPayload` (Slice E). Both reuse `/publish`, `/season`, `/coverage`, `saveReport`, and the tab-aware controls unchanged; each adds a payload type, a tab component, enables its tab, and adds a runbook section.
- Tagging media with a subsystem at upload time.

## Self-Review notes

- Spec coverage: `/season` (Task 3), `/coverage` (Task 2), `/publish` secret-gated (Task 4), shared types (Task 1), Gaps tab (Tasks 5-6), runbook (Task 7). Deploy note (set `NOTEBOOK_PUBLISH_SECRET`) is called out in the runbook prerequisites and belongs to post-merge deploy, not a code task.
- Type consistency: `saveReport(env, kind, payload)` used by both `generate/timeline` and `/publish`. `GapPayload`/`GapStatus` consistent across types, GapsTab, and NotebookView. `CoverageStats`/`SeasonExport` shapes match the worker builders and the tests.
- Reuse: the write path is DRY via `saveReport` (removes the duplicated upsert+fulfil that Slice B had inline in generate/timeline). Coverage/timeline/season all reuse the committees-first ordering idiom.
