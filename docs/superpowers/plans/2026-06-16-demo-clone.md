# Demo Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully interactive, backend-free demo of the WeekLog app on a `demo` branch by replacing the network layer (`frontend/src/lib/api.ts`) with an in-browser mock backed by seeded localStorage data, keeping real Supabase magic-link auth.

**Architecture:** Every data call funnels through four functions in `frontend/src/lib/api.ts` (`api`, `apiForm`, `apiBlobUrl`, `downloadAuthed`). On the `demo` branch these delegate to a new in-browser router (`frontend/src/lib/demo/router.ts`) that reads/writes a localStorage-persisted data graph (`store.ts`), recomputing derived views (`compute.ts`, ported verbatim from the Worker) on each read. Seed data (`seed.ts`) is evergreen (dates relative to today). Auth files are untouched. Every hook and component stays byte-for-byte identical.

**Tech Stack:** React + TypeScript + Vite + Vitest. No new dependencies. `crypto.randomUUID()` for ids.

**Spec:** `docs/superpowers/specs/2026-06-16-demo-clone-design.md`

---

## File Structure

- Create `frontend/src/lib/demo/types.ts` — `DemoDB` table-row interfaces.
- Create `frontend/src/lib/demo/compute.ts` — pure derivation (RAG, requirement status, dashboard helpers), ported from `worker/src/{compliance,status,dayStatus}.ts`.
- Create `frontend/src/lib/demo/seed.ts` — evergreen sample dataset builder.
- Create `frontend/src/lib/demo/store.ts` — localStorage load/save/reset of `DemoDB`.
- Create `frontend/src/lib/demo/media.ts` — in-memory blob URL registry + placeholder image.
- Create `frontend/src/lib/demo/router.ts` — `route(method, path, body?, form?)` mapping every endpoint to handlers.
- Create `frontend/src/lib/demo/*.test.ts` — unit tests for compute, store, router.
- Modify `frontend/src/lib/api.ts` — delegate to `router`/`media` instead of `fetch`.
- Modify `frontend/src/lib/api.test.ts` — assert demo delegation instead of fetch/token wiring.
- Create `frontend/src/ui/DemoBadge.tsx` — "DEMO" pill + Reset control.
- Modify `frontend/src/App.tsx` — render `<DemoBadge />` in the shell.
- Create `DEMO.md` — branch readme documenting the demo + simplifications.

---

### Task 0: Create the `demo` branch

- [ ] **Step 1: Branch off master**

Run:
```bash
git checkout -b demo
```
Expected: `Switched to a new branch 'demo'`

- [ ] **Step 2: Confirm clean start**

Run: `git status`
Expected: on branch `demo`. (The pre-existing modified files under `frontend/src` from before this work are unrelated; leave them untouched — do not stage them in any commit below.)

---

### Task 1: Demo data types

**Files:**
- Create: `frontend/src/lib/demo/types.ts`

- [ ] **Step 1: Write the row types**

```typescript
// frontend/src/lib/demo/types.ts
// Normalized in-browser mirror of the Worker's D1 tables. Each array is a table.

export interface CommitteeRow { id: string; name: string; sort_order: number }
export interface MemberRow { id: string; name: string; active: number }
export interface MemberCommitteeRow { member_id: string; committee_id: string }
export interface TemplateRow {
  id: string; label: string; description: string | null;
  compulsory: number; expected_kind: string | null; active: number; sort_order: number;
}
export interface MeetingDayRow { id: string; date: string; title: string | null }
export interface MeetingRequirementRow {
  id: string; meeting_day_id: string; template_id: string | null; label: string;
  compulsory: number; expected_kind: string | null; status: string; active: number; custom: number;
}
export interface AttendanceRow { id: string; meeting_day_id: string; member_id: string; present: number }
export interface SubmissionRow {
  id: string; meeting_day_id: string; requirement_id: string | null; kind: string;
  subsystem: string | null; content: string | null; created_by: string | null;
  created_at: string; resolved: number;
}
export interface MediaRow {
  id: string; meeting_day_id: string | null; deadline_id: string | null; requirement_id: string | null;
  subsystem: string | null; caption: string | null; kind: string | null;
  content_type: string | null; uploaded_by: string | null; uploaded_at: string;
}
export interface DeadlineRow {
  id: string; title: string; description: string | null; category: string | null;
  due_date: string; status: string; completed_at: string | null; link: string | null;
}

export interface DemoDB {
  committees: CommitteeRow[];
  members: MemberRow[];
  member_committees: MemberCommitteeRow[];
  templates: TemplateRow[];
  meeting_days: MeetingDayRow[];
  meeting_requirements: MeetingRequirementRow[];
  attendance: AttendanceRow[];
  submissions: SubmissionRow[];
  media: MediaRow[];
  deadlines: DeadlineRow[];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/demo/types.ts
git commit -m "feat(demo): data model types for in-browser store"
```

---

### Task 2: Pure compute (ported from Worker)

**Files:**
- Create: `frontend/src/lib/demo/compute.ts`
- Test: `frontend/src/lib/demo/compute.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/demo/compute.test.ts
import { describe, it, expect } from "vitest";
import { dayRag, deadlineRag, deriveRequirementStatus, deriveDay, dayStatusFromDerived } from "./compute";
import type { DemoDB } from "./types";

describe("dayRag", () => {
  it("green when no compulsory items", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 0, compulsorySatisfied: 0 })).toBe("green");
  });
  it("green when all compulsory satisfied", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 2 })).toBe("green");
  });
  it("red when past and incomplete", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 1 })).toBe("red");
  });
  it("amber when today/future and incomplete", () => {
    expect(dayRag({ date: "2026-02-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 1 })).toBe("amber");
  });
});

describe("deadlineRag", () => {
  it("green when done", () => {
    expect(deadlineRag({ status: "done", due_date: "2026-01-01", today: "2026-02-01" })).toBe("green");
  });
  it("red when open and overdue", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-01-01", today: "2026-02-01" })).toBe("red");
  });
  it("amber when due within 7 days", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-02-05", today: "2026-02-01" })).toBe("amber");
  });
  it("green when open and far out", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-03-01", today: "2026-02-01" })).toBe("green");
  });
});

describe("deriveDay + dayStatusFromDerived", () => {
  const db: DemoDB = {
    committees: [], members: [], member_committees: [], templates: [],
    meeting_days: [{ id: "d1", date: "2026-01-10", title: null }],
    meeting_requirements: [
      { id: "r-att", meeting_day_id: "d1", template_id: null, label: "Attendance", compulsory: 1, expected_kind: "attendance", status: "missing", active: 1, custom: 0 },
      { id: "r-txt", meeting_day_id: "d1", template_id: null, label: "Accomplishments", compulsory: 1, expected_kind: "text", status: "missing", active: 1, custom: 0 },
    ],
    attendance: [{ id: "a1", meeting_day_id: "d1", member_id: "m1", present: 1 }],
    submissions: [], media: [], deadlines: [],
  };

  it("attendance satisfied by a present member, text still missing", () => {
    const derived = deriveDay(db, "d1");
    expect(derived.requirements.find((r) => r.id === "r-att")!.status).toBe("submitted");
    expect(derived.requirements.find((r) => r.id === "r-txt")!.status).toBe("missing");
    expect(derived.missingCompulsory.map((r) => r.id)).toEqual(["r-txt"]);
    expect(dayStatusFromDerived("2026-01-10", "2026-02-01", derived)).toBe("red");
  });

  it("text satisfied by an unassigned text-kind submission", () => {
    const db2: DemoDB = { ...db, submissions: [{ id: "s1", meeting_day_id: "d1", requirement_id: null, kind: "accomplishment", subsystem: null, content: "did x", created_by: "a@b.c", created_at: "2026-01-10T00:00:00Z", resolved: 0 }] };
    const derived = deriveDay(db2, "d1");
    expect(derived.missingCompulsory).toHaveLength(0);
    expect(dayStatusFromDerived("2026-01-10", "2026-02-01", derived)).toBe("green");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/demo/compute.test.ts`
Expected: FAIL — cannot find module `./compute`.

- [ ] **Step 3: Write the implementation (verbatim port)**

```typescript
// frontend/src/lib/demo/compute.ts
// Pure derivation logic ported verbatim from worker/src/{compliance,status,dayStatus}.ts,
// re-expressed over the in-browser DemoDB arrays instead of D1 SQL.
import type { DemoDB, MeetingRequirementRow } from "./types";

export type Rag = "green" | "amber" | "red";

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetweenUTC(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function addDaysUTC(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayRag(input: { date: string; today: string; compulsoryTotal: number; compulsorySatisfied: number }): Rag {
  const { date, today, compulsoryTotal, compulsorySatisfied } = input;
  if (compulsoryTotal === 0 || compulsorySatisfied >= compulsoryTotal) return "green";
  if (date < today) return "red";
  return "amber";
}

export function deadlineRag(input: { status: string; due_date: string; today: string }): Rag {
  if (input.status === "done") return "green";
  if (input.due_date < input.today) return "red";
  if (daysBetweenUTC(input.today, input.due_date) <= 7) return "amber";
  return "green";
}

const TEXT_KINDS = new Set(["accomplishment", "build_need", "performance_goal", "failure", "note"]);

export interface DerivedReq extends MeetingRequirementRow {
  status: "submitted" | "missing";
}

interface SubCtx { requirement_id: string | null; kind: string }
interface MedCtx { requirement_id: string | null }

export function deriveRequirementStatus(
  reqs: MeetingRequirementRow[],
  ctx: { presentCount: number; submissions: SubCtx[]; media: MedCtx[] }
): { requirements: DerivedReq[]; missingCompulsory: DerivedReq[] } {
  const requirements: DerivedReq[] = reqs.map((r) => ({ ...r, status: isSatisfied(r, ctx) ? "submitted" : "missing" }));
  const missingCompulsory = requirements.filter((r) => r.compulsory === 1 && r.status === "missing");
  return { requirements, missingCompulsory };
}

function isSatisfied(r: MeetingRequirementRow, ctx: { presentCount: number; submissions: SubCtx[]; media: MedCtx[] }): boolean {
  if (r.expected_kind === "attendance") return ctx.presentCount > 0;
  if (ctx.submissions.some((s) => s.requirement_id === r.id)) return true;
  if (ctx.media.some((m) => m.requirement_id === r.id)) return true;
  if (r.expected_kind === "media") return ctx.media.some((m) => m.requirement_id == null);
  if (r.expected_kind === "text") return ctx.submissions.some((s) => s.requirement_id == null && TEXT_KINDS.has(s.kind));
  if (r.expected_kind === "any") return ctx.submissions.length > 0 || ctx.media.length > 0;
  return false;
}

// Equivalent of worker deriveDay(): pull this day's live context from the arrays.
export function deriveDay(db: DemoDB, dayId: string): { requirements: DerivedReq[]; missingCompulsory: DerivedReq[] } {
  const reqs = db.meeting_requirements
    .filter((r) => r.meeting_day_id === dayId && r.active === 1)
    .sort((a, b) => (b.compulsory - a.compulsory) || a.label.localeCompare(b.label));
  const presentCount = db.attendance.filter((a) => a.meeting_day_id === dayId && a.present === 1).length;
  const submissions = db.submissions.filter((s) => s.meeting_day_id === dayId).map((s) => ({ requirement_id: s.requirement_id, kind: s.kind }));
  const media = db.media.filter((m) => m.meeting_day_id === dayId).map((m) => ({ requirement_id: m.requirement_id }));
  return deriveRequirementStatus(reqs, { presentCount, submissions, media });
}

export function dayStatusFromDerived(date: string, today: string, derived: { requirements: DerivedReq[] }): Rag {
  const compulsory = derived.requirements.filter((r) => r.compulsory === 1);
  const satisfied = compulsory.filter((r) => r.status === "submitted").length;
  return dayRag({ date, today, compulsoryTotal: compulsory.length, compulsorySatisfied: satisfied });
}

// Committee names (sorted) for a member, mirroring the Worker's GROUP_CONCAT + split.
export function committeesOf(db: DemoDB, memberId: string): string[] {
  const ids = db.member_committees.filter((mc) => mc.member_id === memberId).map((mc) => mc.committee_id);
  return db.committees.filter((c) => ids.includes(c.id)).map((c) => c.name).sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/demo/compute.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/demo/compute.ts frontend/src/lib/demo/compute.test.ts
git commit -m "feat(demo): pure compute ported from worker (RAG, requirement status)"
```

---

### Task 3: Seed dataset (evergreen)

**Files:**
- Create: `frontend/src/lib/demo/seed.ts`
- Test: `frontend/src/lib/demo/seed.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/demo/seed.test.ts
import { describe, it, expect } from "vitest";
import { buildSeed } from "./seed";
import { deriveDay, dayStatusFromDerived, todayUTC } from "./compute";

describe("buildSeed", () => {
  it("produces a populated, varied dataset", () => {
    const db = buildSeed();
    expect(db.members.length).toBeGreaterThanOrEqual(6);
    expect(db.committees.length).toBeGreaterThanOrEqual(3);
    expect(db.templates.filter((t) => t.active === 1).length).toBeGreaterThanOrEqual(3);
    expect(db.meeting_days.length).toBeGreaterThanOrEqual(5);
    expect(db.deadlines.length).toBeGreaterThanOrEqual(4);

    // Every meeting day has a snapshotted requirement checklist.
    for (const d of db.meeting_days) {
      expect(db.meeting_requirements.some((r) => r.meeting_day_id === d.id)).toBe(true);
    }

    // The RAG spread includes at least one green and one non-green day.
    const today = todayUTC();
    const statuses = db.meeting_days.map((d) => dayStatusFromDerived(d.date, today, deriveDay(db, d.id)));
    expect(statuses).toContain("green");
    expect(statuses.some((s) => s !== "green")).toBe(true);
  });

  it("returns a fresh independent copy each call", () => {
    const a = buildSeed();
    const b = buildSeed();
    a.members.push({ id: "x", name: "Z", active: 1 });
    expect(b.members.find((m) => m.id === "x")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/demo/seed.test.ts`
Expected: FAIL — cannot find module `./seed`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/demo/seed.ts
// Builds a fresh, evergreen sample dataset. Dates are relative to today so the
// RAG / health views always show a realistic spread regardless of when viewed.
import type { DemoDB, MeetingRequirementRow, TemplateRow } from "./types";
import { addDaysUTC, todayUTC } from "./compute";

const uuid = () => crypto.randomUUID();

const SUBSYSTEMS = ["Drivetrain/Collector", "Shooter", "Programming", "Strategy"];

export function buildSeed(): DemoDB {
  const today = todayUTC();

  const committees = [
    { id: "c-build", name: "Build", sort_order: 1 },
    { id: "c-prog", name: "Programming", sort_order: 2 },
    { id: "c-strat", name: "Strategy", sort_order: 3 },
    { id: "c-media", name: "Media", sort_order: 4 },
    { id: "c-drive", name: "Drive Team", sort_order: 5 },
  ];

  const members = [
    { id: "m1", name: "Ava Chen", active: 1 },
    { id: "m2", name: "Ben Okafor", active: 1 },
    { id: "m3", name: "Carla Diaz", active: 1 },
    { id: "m4", name: "Dev Patel", active: 1 },
    { id: "m5", name: "Ella Novak", active: 1 },
    { id: "m6", name: "Finn Murphy", active: 1 },
    { id: "m7", name: "Gita Rao", active: 1 },
    { id: "m8", name: "Hiro Tanaka", active: 1 },
  ];

  const member_committees = [
    { member_id: "m1", committee_id: "c-build" },
    { member_id: "m1", committee_id: "c-drive" },
    { member_id: "m2", committee_id: "c-prog" },
    { member_id: "m3", committee_id: "c-strat" },
    { member_id: "m4", committee_id: "c-prog" },
    { member_id: "m4", committee_id: "c-build" },
    { member_id: "m5", committee_id: "c-media" },
    { member_id: "m6", committee_id: "c-build" },
    { member_id: "m7", committee_id: "c-strat" },
    { member_id: "m7", committee_id: "c-drive" },
    { member_id: "m8", committee_id: "c-prog" },
  ];

  const templates: TemplateRow[] = [
    { id: "t-att", label: "Attendance", description: "Who showed up", compulsory: 1, expected_kind: "attendance", active: 1, sort_order: 1 },
    { id: "t-acc", label: "Daily accomplishments", description: null, compulsory: 1, expected_kind: "text", active: 1, sort_order: 2 },
    { id: "t-perf", label: "Performance goals", description: null, compulsory: 1, expected_kind: "text", active: 1, sort_order: 3 },
    { id: "t-build", label: "Build needs", description: null, compulsory: 0, expected_kind: "text", active: 1, sort_order: 4 },
    { id: "t-photo", label: "Photos & media", description: null, compulsory: 0, expected_kind: "media", active: 1, sort_order: 5 },
  ];

  const db: DemoDB = {
    committees, members, member_committees, templates,
    meeting_days: [], meeting_requirements: [], attendance: [], submissions: [], media: [], deadlines: [],
  };

  // Snapshot the active templates onto a new meeting day (mirrors worker snapshot).
  const snapshot = (dayId: string) => {
    for (const t of templates.filter((x) => x.active === 1).sort((a, b) => a.sort_order - b.sort_order)) {
      db.meeting_requirements.push({
        id: uuid(), meeting_day_id: dayId, template_id: t.id, label: t.label,
        compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0,
      });
    }
  };

  // Satisfy every compulsory requirement on a day so it derives green.
  const satisfyDay = (dayId: string) => {
    const reqs = db.meeting_requirements.filter((r) => r.meeting_day_id === dayId && r.active === 1);
    db.attendance.push(
      { id: uuid(), meeting_day_id: dayId, member_id: "m1", present: 1 },
      { id: uuid(), meeting_day_id: dayId, member_id: "m2", present: 1 },
      { id: uuid(), meeting_day_id: dayId, member_id: "m4", present: 1 },
    );
    for (const r of reqs) {
      if (r.expected_kind === "text") {
        db.submissions.push({
          id: uuid(), meeting_day_id: dayId, requirement_id: r.id, kind: "accomplishment",
          subsystem: SUBSYSTEMS[0], content: `Logged: ${r.label.toLowerCase()}.`,
          created_by: "ava@demo.app", created_at: `${db.meeting_days.find((d) => d.id === dayId)!.date}T18:00:00Z`, resolved: 0,
        });
      } else if (r.expected_kind === "media") {
        db.media.push({
          id: uuid(), meeting_day_id: dayId, deadline_id: null, requirement_id: r.id, subsystem: null,
          caption: "Build progress", kind: "photo", content_type: "image/svg+xml",
          uploaded_by: "ella@demo.app", uploaded_at: `${db.meeting_days.find((d) => d.id === dayId)!.date}T18:05:00Z`,
        });
      }
    }
  };

  // Six days spanning past→future to spread RAG: green / red / green / red / amber / amber.
  const plan: Array<{ date: string; title: string | null; complete: boolean }> = [
    { date: addDaysUTC(today, -21), title: "Kickoff build", complete: true },
    { date: addDaysUTC(today, -14), title: null, complete: false },
    { date: addDaysUTC(today, -7), title: "Shooter tuning", complete: true },
    { date: addDaysUTC(today, -2), title: null, complete: false },
    { date: today, title: "Today's session", complete: false },
    { date: addDaysUTC(today, 3), title: "Scrimmage prep", complete: false },
  ];
  for (const p of plan) {
    const id = uuid();
    db.meeting_days.push({ id, date: p.date, title: p.title });
    snapshot(id);
    if (p.complete) satisfyDay(id);
    else {
      // Partial activity so the day isn't empty but stays non-green.
      db.attendance.push({ id: uuid(), meeting_day_id: id, member_id: "m1", present: 1 });
    }
  }

  // A couple of standalone build-need submissions for the Browse view.
  const firstGreenDay = db.meeting_days[0].id;
  db.submissions.push(
    { id: uuid(), meeting_day_id: firstGreenDay, requirement_id: null, kind: "build_need", subsystem: "Shooter", content: "Need spare flywheel belts ordered.", created_by: "ben@demo.app", created_at: `${db.meeting_days[0].date}T19:00:00Z`, resolved: 0 },
    { id: uuid(), meeting_day_id: firstGreenDay, requirement_id: null, kind: "build_need", subsystem: "Programming", content: "Vision pipeline FPS too low.", created_by: "dev@demo.app", created_at: `${db.meeting_days[0].date}T19:05:00Z`, resolved: 1 },
  );

  db.deadlines.push(
    { id: uuid(), title: "Submit chairman's essay", description: "Final draft to mentors", category: "strategy", due_date: addDaysUTC(today, -5), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Order competition parts", description: null, category: "other", due_date: addDaysUTC(today, 3), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Sponsor thank-you posts", description: null, category: "social_media", due_date: addDaysUTC(today, 18), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Pit banner design", description: "Approved by team", category: "design", due_date: addDaysUTC(today, -10), status: "done", completed_at: `${addDaysUTC(today, -12)}T00:00:00Z`, link: null },
    { id: uuid(), title: "Register for district event", description: null, category: "other", due_date: addDaysUTC(today, 25), status: "open", completed_at: null, link: "https://example.org/register" },
  );

  return db;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/demo/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/demo/seed.ts frontend/src/lib/demo/seed.test.ts
git commit -m "feat(demo): evergreen sample seed dataset"
```

---

### Task 4: localStorage store

**Files:**
- Create: `frontend/src/lib/demo/store.ts`
- Test: `frontend/src/lib/demo/store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/demo/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { load, save, reset, STORAGE_KEY } from "./store";

beforeEach(() => localStorage.clear());

describe("store", () => {
  it("seeds on first load and persists the same data on next load", () => {
    const a = load();
    expect(a.members.length).toBeGreaterThan(0);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    const b = load();
    expect(b.meeting_days.map((d) => d.id)).toEqual(a.meeting_days.map((d) => d.id));
  });

  it("save persists mutations", () => {
    const db = load();
    db.members.push({ id: "zz", name: "New Person", active: 1 });
    save(db);
    expect(load().members.find((m) => m.id === "zz")).toBeTruthy();
  });

  it("reset restores a fresh seed", () => {
    const db = load();
    db.members = [];
    save(db);
    expect(load().members.length).toBe(0);
    reset();
    expect(load().members.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/demo/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/demo/store.ts
// localStorage-backed DemoDB. Seeds on first use; persists every mutation.
import type { DemoDB } from "./types";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "weeklog-demo-v1";

export function load(): DemoDB {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDB;
    } catch {
      // Corrupt payload — fall through to a fresh seed.
    }
  }
  const seed = buildSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

export function save(db: DemoDB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function reset(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeed()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/demo/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/demo/store.ts frontend/src/lib/demo/store.test.ts
git commit -m "feat(demo): localStorage store with seed + reset"
```

---

### Task 5: Media blob registry

**Files:**
- Create: `frontend/src/lib/demo/media.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/lib/demo/media.ts
// Uploaded blobs live only in memory for the session (localStorage can't hold
// binaries). Metadata persists in the store; if a blob isn't present (e.g. after
// a refresh, or for seed media), apiBlobUrl falls back to a bundled placeholder.

const blobs = new Map<string, string>(); // mediaId -> object URL

// A neutral inline SVG placeholder (data URL, always available).
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='200'>` +
      `<rect width='100%' height='100%' fill='#2a2320'/>` +
      `<text x='50%' y='50%' fill='#b98a72' font-family='monospace' font-size='13' ` +
      `text-anchor='middle' dominant-baseline='middle'>demo media</text></svg>`
  );

export function putBlob(mediaId: string, file: File): void {
  blobs.set(mediaId, URL.createObjectURL(file));
}

export function urlFor(mediaId: string): string {
  return blobs.get(mediaId) ?? PLACEHOLDER;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/demo/media.ts
git commit -m "feat(demo): in-memory media blob registry with placeholder"
```

---

### Task 6: Router

**Files:**
- Create: `frontend/src/lib/demo/router.ts`
- Test: `frontend/src/lib/demo/router.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/demo/router.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { route } from "./router";

beforeEach(() => localStorage.clear());

describe("router", () => {
  it("GET /api/me reports admin", () => {
    expect(route("GET", "/api/me")).toEqual({ email: "demo@demo.app", isAdmin: true });
  });

  it("GET /api/drive/status is not configured", () => {
    expect(route("GET", "/api/drive/status")).toEqual({ configured: false });
  });

  it("lists meeting days with a derived status", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string; status: string }>;
    expect(days.length).toBeGreaterThan(0);
    expect(["green", "amber", "red"]).toContain(days[0].status);
  });

  it("attendance returns members by name and toggles present", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string }>;
    const id = days[0].id;
    const att = route("GET", `/api/meeting-days/${id}/attendance`) as Array<{ member_id: string; name: string; present: number }>;
    expect(att[0].name).toBeTruthy();
    const target = att.find((a) => a.present === 0) ?? att[0];
    route("POST", `/api/meeting-days/${id}/attendance`, { member_id: target.member_id, present: 1 });
    const att2 = route("GET", `/api/meeting-days/${id}/attendance`) as Array<{ member_id: string; present: number }>;
    expect(att2.find((a) => a.member_id === target.member_id)!.present).toBe(1);
  });

  it("adds a text submission and flips the requirement to submitted", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string }>;
    // pick the second day (seeded incomplete) so a text req is initially missing
    const id = days[1].id;
    const before = route("GET", `/api/meeting-days/${id}`) as { requirements: Array<{ id: string; expected_kind: string | null; status: string }> };
    const textReq = before.requirements.find((r) => r.expected_kind === "text")!;
    route("POST", `/api/meeting-days/${id}/submissions`, { kind: "accomplishment", content: "hi", requirement_id: textReq.id });
    const after = route("GET", `/api/meeting-days/${id}`) as { requirements: Array<{ id: string; status: string }> };
    expect(after.requirements.find((r) => r.id === textReq.id)!.status).toBe("submitted");
  });

  it("search filters submissions by query", () => {
    const res = route("GET", "/api/search?q=flywheel") as Array<{ content: string }>;
    expect(res.every((r) => (r.content ?? "").toLowerCase().includes("flywheel"))).toBe(true);
    expect(res.length).toBeGreaterThan(0);
  });

  it("dashboard returns overall RAG and counts", () => {
    const dash = route("GET", "/api/dashboard") as { overall: string; counts: { daysFlagged: number } };
    expect(["green", "amber", "red"]).toContain(dash.overall);
    expect(typeof dash.counts.daysFlagged).toBe("number");
  });

  it("throws on an unknown route", () => {
    expect(() => route("GET", "/api/nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/demo/router.test.ts`
Expected: FAIL — cannot find module `./router`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/demo/router.ts
// In-browser replacement for the Worker's HTTP API. route() matches method+path
// against handlers that read/write the localStorage DemoDB and return plain JSON,
// mirroring worker/src/routes/* behavior. Everyone is admin in the demo.
import { load, save } from "./store";
import { putBlob } from "./media";
import {
  deriveDay, dayStatusFromDerived, deadlineRag, daysBetweenUTC, addDaysUTC,
  committeesOf, todayUTC, type Rag,
} from "./compute";
import type { DemoDB } from "./types";

const uuid = () => crypto.randomUUID();
const DEMO_EMAIL = "demo@demo.app";

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(`${status}: ${msg}`); }
}

// Parse "/api/x?y=z" into a pathname + query map.
function parse(path: string): { pathname: string; query: URLSearchParams } {
  const u = new URL(path, "http://demo.local");
  return { pathname: u.pathname, query: u.searchParams };
}

export function route(method: string, path: string, body?: unknown, form?: FormData): unknown {
  const db = load();
  const { pathname, query } = parse(path);
  const seg = pathname.replace(/^\/api\//, "").split("/"); // e.g. ["meeting-days", "<id>", "attendance"]
  const m = method.toUpperCase();
  const b = (body ?? {}) as Record<string, unknown>;

  const result = dispatch(db, m, seg, query, b, form);
  save(db); // persist any mutation the handler made
  return result;
}

function dispatch(db: DemoDB, m: string, seg: string[], q: URLSearchParams, b: Record<string, unknown>, form?: FormData): unknown {
  const today = todayUTC();
  const head = seg[0];

  // ---- identity / integrations ----
  if (head === "me" && m === "GET") return { email: DEMO_EMAIL, isAdmin: true };
  if (head === "drive" && seg[1] === "status" && m === "GET") return { configured: false };

  // ---- committees ----
  if (head === "committees" && m === "GET") {
    return [...db.committees].sort((a, c) => a.sort_order - c.sort_order || a.name.localeCompare(c.name))
      .map((c) => ({ id: c.id, name: c.name }));
  }

  // ---- members ----
  if (head === "members") {
    if (m === "GET") {
      const activeOnly = q.get("active") === "1";
      return db.members
        .filter((mem) => !activeOnly || mem.active === 1)
        .sort((a, c) => a.name.localeCompare(c.name))
        .map((mem) => ({ id: mem.id, name: mem.name, active: mem.active, committees: committeesOf(db, mem.id) }));
    }
    if (m === "POST") {
      const name = String(b.name ?? "").trim();
      if (!name) throw new HttpError(400, "name required");
      const id = uuid();
      db.members.push({ id, name, active: 1 });
      setCommittees(db, id, (b.committeeIds as string[]) ?? []);
      return loadMember(db, id);
    }
    if (m === "PATCH" && seg[1]) {
      const mem = db.members.find((x) => x.id === seg[1]);
      if (!mem) throw new HttpError(404, "not found");
      if (typeof b.name === "string") mem.name = b.name;
      if (typeof b.active === "number") mem.active = b.active;
      if (Array.isArray(b.committeeIds)) setCommittees(db, mem.id, b.committeeIds as string[]);
      return loadMember(db, mem.id);
    }
  }

  // ---- requirement templates ----
  if (head === "requirement-templates") {
    if (seg[1] === "reorder" && m === "POST") {
      const ids = (b.ids as string[]) ?? [];
      ids.forEach((id, i) => { const t = db.templates.find((x) => x.id === id); if (t) t.sort_order = i + 1; });
      return { ok: true };
    }
    if (m === "GET") {
      const activeOnly = q.get("active") === "1";
      return db.templates.filter((t) => !activeOnly || t.active === 1).sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0));
    }
    if (m === "POST") {
      const label = String(b.label ?? "").trim();
      if (!label) throw new HttpError(400, "label required");
      const sort = Math.max(0, ...db.templates.map((t) => t.sort_order ?? 0)) + 1;
      const row = { id: uuid(), label, description: (b.description as string) ?? null, compulsory: (b.compulsory as number) ?? 1, expected_kind: (b.expected_kind as string) ?? null, active: 1, sort_order: sort };
      db.templates.push(row);
      return row;
    }
    if (m === "PATCH" && seg[1]) {
      const t = db.templates.find((x) => x.id === seg[1]);
      if (!t) throw new HttpError(404, "not found");
      if (b.label !== undefined) t.label = b.label as string;
      if (b.description !== undefined) t.description = b.description as string | null;
      if (b.compulsory !== undefined) t.compulsory = b.compulsory as number;
      if (b.expected_kind !== undefined) t.expected_kind = b.expected_kind as string | null;
      if (b.active !== undefined) t.active = b.active as number;
      if (b.sort_order !== undefined) t.sort_order = b.sort_order as number;
      return t;
    }
  }

  // ---- deadlines ----
  if (head === "deadlines") {
    if (!seg[1] && m === "GET") {
      return [...db.deadlines].sort((a, c) => a.due_date.localeCompare(c.due_date))
        .map((d) => ({ ...d, status_rag: deadlineRag({ status: d.status, due_date: d.due_date, today }) }));
    }
    if (!seg[1] && m === "POST") {
      if (!b.title || !b.due_date) throw new HttpError(400, "title and due_date required");
      const row = { id: uuid(), title: b.title as string, description: (b.description as string) ?? null, category: (b.category as string) ?? null, due_date: b.due_date as string, status: "open", completed_at: null, link: (b.link as string) ?? null };
      db.deadlines.push(row);
      return row;
    }
    if (seg[1] && seg[2] === "done" && m === "POST") {
      const d = db.deadlines.find((x) => x.id === seg[1]);
      if (!d) throw new HttpError(404, "not found");
      d.status = "done"; d.completed_at = new Date().toISOString();
      return d;
    }
    if (seg[1] && seg[2] === "reopen" && m === "POST") {
      const d = db.deadlines.find((x) => x.id === seg[1]);
      if (d) { d.status = "open"; d.completed_at = null; }
      return d ?? { ok: true };
    }
    if (seg[1] && seg[2] === "media" && m === "GET") {
      return db.media.filter((x) => x.deadline_id === seg[1]).sort((a, c) => (c.uploaded_at).localeCompare(a.uploaded_at));
    }
    if (seg[1] && seg[2] === "media" && m === "POST") {
      return addMedia(db, form, { deadline_id: seg[1] });
    }
    if (seg[1] && !seg[2] && m === "DELETE") {
      db.deadlines = db.deadlines.filter((x) => x.id !== seg[1]);
      return { ok: true };
    }
  }

  // ---- search + build needs ----
  if (head === "search" && m === "GET") return runSearch(db, q, today);
  if (head === "build-needs" && m === "GET") {
    const openOnly = q.get("open") === "1";
    return db.submissions
      .filter((s) => s.kind === "build_need" && (!openOnly || s.resolved === 0))
      .map((s) => ({ ...s, date: dateOf(db, s.meeting_day_id) }))
      .sort((a, c) => (c.date ?? "").localeCompare(a.date ?? ""));
  }

  // ---- submissions resolve/unresolve ----
  if (head === "submissions" && seg[1] && (seg[2] === "resolve" || seg[2] === "unresolve") && m === "POST") {
    const s = db.submissions.find((x) => x.id === seg[1]);
    const resolved = seg[2] === "resolve" ? 1 : 0;
    if (s) s.resolved = resolved;
    return { ok: true, resolved };
  }

  // ---- media file (served via apiBlobUrl, not here) ----

  // ---- dashboard ----
  if (head === "dashboard" && m === "GET") return buildDashboard(db, today);

  // ---- meeting days ----
  if (head === "meeting-days") return meetingDays(db, m, seg, q, b, form, today);

  throw new HttpError(404, `no route for ${m} /api/${seg.join("/")}`);
}

// ---------- meeting-days sub-router ----------
function meetingDays(db: DemoDB, m: string, seg: string[], q: URLSearchParams, b: Record<string, unknown>, form: FormData | undefined, today: string): unknown {
  // /api/meeting-days
  if (!seg[1]) {
    if (m === "GET") {
      const from = q.get("from"); const to = q.get("to");
      return db.meeting_days
        .filter((d) => !from || !to || (d.date >= from && d.date <= to))
        .sort((a, c) => a.date.localeCompare(c.date))
        .map((d) => ({ ...d, status: dayStatusFromDerived(d.date, today, deriveDay(db, d.id)) }));
    }
    if (m === "POST") {
      const date = String(b.date ?? "");
      if (!date) throw new HttpError(400, "date required");
      if (db.meeting_days.some((d) => d.date === date)) throw new HttpError(409, "already a meeting day");
      const id = uuid();
      db.meeting_days.push({ id, date, title: (b.title as string) ?? null });
      const count = snapshot(db, id);
      return { id, date, title: (b.title as string) ?? null, requirementCount: count };
    }
  }

  const id = seg[1];
  const day = db.meeting_days.find((d) => d.id === id);

  // /api/meeting-days/:id
  if (seg.length === 2) {
    if (m === "GET") {
      if (!day) throw new HttpError(404, "not found");
      const derived = deriveDay(db, id);
      return { ...day, status: dayStatusFromDerived(day.date, today, derived), requirements: derived.requirements, missingCompulsory: derived.missingCompulsory };
    }
    if (m === "PATCH") {
      if (!day) throw new HttpError(404, "not found");
      const raw = b.title;
      day.title = raw == null ? null : String(raw).trim().slice(0, 120) || null;
      return { ok: true, ...day };
    }
    if (m === "DELETE") {
      db.media = db.media.filter((x) => x.meeting_day_id !== id);
      db.submissions = db.submissions.filter((x) => x.meeting_day_id !== id);
      db.attendance = db.attendance.filter((x) => x.meeting_day_id !== id);
      db.meeting_requirements = db.meeting_requirements.filter((x) => x.meeting_day_id !== id);
      db.meeting_days = db.meeting_days.filter((x) => x.id !== id);
      return { ok: true };
    }
  }

  const sub = seg[2];
  if (sub === "attendance") {
    if (m === "GET") {
      return db.members.filter((mem) => mem.active === 1).sort((a, c) => a.name.localeCompare(c.name)).map((mem) => {
        const att = db.attendance.find((a) => a.meeting_day_id === id && a.member_id === mem.id);
        return { member_id: mem.id, name: mem.name, present: att?.present ?? 0, committees: committeesOf(db, mem.id) };
      });
    }
    if (m === "POST") {
      const memberId = b.member_id as string;
      if (!memberId) throw new HttpError(400, "member_id required");
      const present = b.present ? 1 : 0;
      const existing = db.attendance.find((a) => a.meeting_day_id === id && a.member_id === memberId);
      if (existing) existing.present = present;
      else db.attendance.push({ id: uuid(), meeting_day_id: id, member_id: memberId, present });
      return { ok: true, member_id: memberId, present };
    }
  }

  if (sub === "submissions") {
    if (m === "GET") {
      return db.submissions.filter((s) => s.meeting_day_id === id).sort((a, c) => c.created_at.localeCompare(a.created_at));
    }
    if (m === "POST") {
      const kind = b.kind as string;
      if (!kind) throw new HttpError(400, "kind required");
      const row = { id: uuid(), meeting_day_id: id, requirement_id: (b.requirement_id as string) ?? null, kind, subsystem: (b.subsystem as string) ?? null, content: (b.content as string) ?? null, created_by: DEMO_EMAIL, created_at: new Date().toISOString(), resolved: 0 };
      db.submissions.push(row);
      return row;
    }
  }

  if (sub === "media") {
    if (m === "GET") {
      return db.media.filter((x) => x.meeting_day_id === id).sort((a, c) => c.uploaded_at.localeCompare(a.uploaded_at));
    }
    if (m === "POST") {
      return addMedia(db, form, { meeting_day_id: id, requirement_id: formStr(form, "requirement_id"), subsystem: formStr(form, "subsystem") });
    }
  }

  if (sub === "requirements") {
    // /api/meeting-days/:id/requirements/available
    if (seg[3] === "available" && m === "GET") {
      const onDay = new Set(db.meeting_requirements.filter((r) => r.meeting_day_id === id && r.active === 1 && r.template_id).map((r) => r.template_id));
      return db.templates.filter((t) => t.active === 1 && !onDay.has(t.id)).sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0))
        .map((t) => ({ id: t.id, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind }));
    }
    // /api/meeting-days/:id/requirements/:reqId
    if (seg[3]) {
      const req = db.meeting_requirements.find((r) => r.id === seg[3] && r.meeting_day_id === id && r.active === 1);
      if (m === "PATCH") {
        if (b.compulsory !== 0 && b.compulsory !== 1) throw new HttpError(400, "compulsory must be 0 or 1");
        if (!req) throw new HttpError(404, "not found");
        req.compulsory = b.compulsory as number;
        return { ok: true, requirements: deriveDay(db, id).requirements };
      }
      if (m === "DELETE") {
        if (!req) throw new HttpError(404, "not found");
        req.active = 0;
        return { ok: true, requirements: deriveDay(db, id).requirements };
      }
    }
    // POST /api/meeting-days/:id/requirements  (add template default or custom)
    if (!seg[3] && m === "POST") {
      if (!day) throw new HttpError(404, "not found");
      if (b.templateId) {
        const tplId = b.templateId as string;
        const existing = db.meeting_requirements.find((r) => r.meeting_day_id === id && r.template_id === tplId);
        if (existing) existing.active = 1;
        else {
          const t = db.templates.find((x) => x.id === tplId && x.active === 1);
          if (!t) throw new HttpError(404, "template not found");
          db.meeting_requirements.push({ id: uuid(), meeting_day_id: id, template_id: tplId, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0 });
        }
      } else if (b.label) {
        const kind = (b.expectedKind as string) ?? "any";
        if (!["attendance", "text", "media", "any"].includes(kind)) throw new HttpError(400, "invalid expectedKind");
        db.meeting_requirements.push({ id: uuid(), meeting_day_id: id, template_id: null, label: b.label as string, compulsory: b.compulsory ? 1 : 0, expected_kind: kind, status: "missing", active: 1, custom: 1 });
      } else {
        throw new HttpError(400, "templateId or label required");
      }
      return { ok: true, requirements: deriveDay(db, id).requirements };
    }
  }

  // ZIP is handled by downloadAuthed in api.ts, not route().
  throw new HttpError(404, `no meeting-days route for ${m} ${seg.join("/")}`);
}

// ---------- helpers ----------
function snapshot(db: DemoDB, dayId: string): number {
  const active = db.templates.filter((t) => t.active === 1).sort((a, c) => a.sort_order - c.sort_order);
  for (const t of active) {
    db.meeting_requirements.push({ id: uuid(), meeting_day_id: dayId, template_id: t.id, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0 });
  }
  return active.length;
}

function setCommittees(db: DemoDB, memberId: string, committeeIds: string[]) {
  db.member_committees = db.member_committees.filter((mc) => mc.member_id !== memberId);
  for (const cid of committeeIds) {
    if (!db.member_committees.some((mc) => mc.member_id === memberId && mc.committee_id === cid)) {
      db.member_committees.push({ member_id: memberId, committee_id: cid });
    }
  }
}

function loadMember(db: DemoDB, id: string) {
  const mem = db.members.find((x) => x.id === id)!;
  return { id: mem.id, name: mem.name, active: mem.active, committees: committeesOf(db, id) };
}

function dateOf(db: DemoDB, dayId: string): string | undefined {
  return db.meeting_days.find((d) => d.id === dayId)?.date;
}

function formStr(form: FormData | undefined, key: string): string | null {
  const v = form?.get(key);
  return typeof v === "string" ? v : null;
}

function addMedia(db: DemoDB, form: FormData | undefined, fields: { meeting_day_id?: string; deadline_id?: string; requirement_id?: string | null; subsystem?: string | null }) {
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file required");
  const id = uuid();
  putBlob(id, file);
  const row = {
    id, meeting_day_id: fields.meeting_day_id ?? null, deadline_id: fields.deadline_id ?? null,
    requirement_id: fields.requirement_id ?? null, subsystem: fields.subsystem ?? null,
    caption: formStr(form, "caption"), kind: formStr(form, "kind"), content_type: file.type || null,
    uploaded_by: DEMO_EMAIL, uploaded_at: new Date().toISOString(),
  };
  db.media.push(row);
  return row;
}

function runSearch(db: DemoDB, q: URLSearchParams, today: string) {
  const get = (k: string) => q.get(k) || undefined;
  const text = get("q"); const subsystem = get("subsystem"); const kind = get("kind");
  const from = get("from"); const to = get("to"); const status = get("status");
  let rows = db.submissions.map((s) => ({ ...s, date: dateOf(db, s.meeting_day_id) ?? "", day_id: s.meeting_day_id }))
    .filter((s) => !text || (s.content ?? "").toLowerCase().includes(text.toLowerCase()))
    .filter((s) => !subsystem || s.subsystem === subsystem)
    .filter((s) => !kind || s.kind === kind)
    .filter((s) => !from || s.date >= from)
    .filter((s) => !to || s.date <= to)
    .sort((a, c) => c.date.localeCompare(a.date) || c.created_at.localeCompare(a.created_at));
  if (status) {
    const byDay = new Map<string, Rag>();
    for (const dayId of new Set(rows.map((r) => r.day_id))) {
      const d = db.meeting_days.find((x) => x.id === dayId)!;
      byDay.set(dayId, dayStatusFromDerived(d.date, today, deriveDay(db, dayId)));
    }
    rows = rows.filter((r) => byDay.get(r.day_id) === status);
  }
  return rows;
}

function buildDashboard(db: DemoDB, today: string) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDaysUTC(today, -dow);
  const weekEnd = addDaysUTC(weekStart, 6);

  const dayStatuses = db.meeting_days
    .sort((a, c) => a.date.localeCompare(c.date))
    .map((d) => ({ id: d.id, date: d.date, status: dayStatusFromDerived(d.date, today, deriveDay(db, d.id)) }));

  const deadlineStatuses = [...db.deadlines].sort((a, c) => a.due_date.localeCompare(c.due_date))
    .map((d) => ({ ...d, rag: deadlineRag({ status: d.status, due_date: d.due_date, today }) }));

  const redDays = dayStatuses.filter((d) => d.status === "red");
  const amberDays = dayStatuses.filter((d) => d.status === "amber");
  const overdue = deadlineStatuses.filter((d) => d.rag === "red");
  const dueSoon = deadlineStatuses.filter((d) => d.rag === "amber");

  let overall: Rag = "green";
  if (redDays.length || overdue.length) overall = "red";
  else if (amberDays.length || dueSoon.length) overall = "amber";

  const needsAttention = [
    ...redDays.map((d) => ({ type: "day" as const, id: d.id, date: d.date, label: `Meeting day ${d.date} has missing compulsory items` })),
    ...overdue.map((d) => ({ type: "deadline" as const, id: d.id, due_date: d.due_date, label: `${d.title} is overdue` })),
  ];

  const thisWeek = dayStatuses.filter((d) => d.date >= weekStart && d.date <= weekEnd);
  const upcomingDeadlines = deadlineStatuses.filter((d) => d.status !== "done")
    .map((d) => ({ id: d.id, title: d.title, due_date: d.due_date, status: d.rag, daysUntil: daysBetweenUTC(today, d.due_date) }))
    .sort((a, c) => a.due_date.localeCompare(c.due_date));

  return {
    today, overall,
    counts: { daysFlagged: redDays.length, deadlinesOverdue: overdue.length, deadlinesDueSoon: dueSoon.length },
    needsAttention, thisWeek, upcomingDeadlines,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/demo/router.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/demo/router.ts frontend/src/lib/demo/router.test.ts
git commit -m "feat(demo): in-browser API router over the demo store"
```

---

### Task 7: Swap the network layer

**Files:**
- Modify: `frontend/src/lib/api.ts` (full replacement of bodies; keep exported signatures)
- Modify: `frontend/src/lib/api.test.ts` (replace fetch-wiring assertions)

- [ ] **Step 1: Replace api.test.ts with demo-delegation tests**

```typescript
// frontend/src/lib/api.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { api, apiForm, apiBlobUrl } from "./api";

beforeEach(() => localStorage.clear());

describe("demo api layer", () => {
  it("api() routes GET to the demo router", async () => {
    const me = await api<{ isAdmin: boolean }>("/api/me");
    expect(me.isAdmin).toBe(true);
  });

  it("api() routes a POST with a JSON body", async () => {
    const days = await api<Array<{ id: string }>>("/api/meeting-days");
    const id = days[0].id;
    const att = await api<Array<{ member_id: string }>>(`/api/meeting-days/${id}/attendance`);
    const res = await api<{ ok: boolean }>(`/api/meeting-days/${id}/attendance`, {
      method: "POST",
      body: JSON.stringify({ member_id: att[0].member_id, present: 1 }),
    });
    expect(res.ok).toBe(true);
  });

  it("apiForm() accepts a media upload and returns a row", async () => {
    const days = await api<Array<{ id: string }>>("/api/meeting-days");
    const form = new FormData();
    form.set("file", new File(["x"], "p.png", { type: "image/png" }));
    const row = await apiForm<{ id: string }>(`/api/meeting-days/${days[0].id}/media`, form);
    expect(row.id).toBeTruthy();
  });

  it("apiBlobUrl() returns a usable URL for media", async () => {
    const url = await apiBlobUrl("/api/media/anything/file");
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/api.test.ts`
Expected: FAIL — current `api.ts` still calls `fetch`; `api("/api/me")` rejects.

- [ ] **Step 3: Replace api.ts with the demo delegation**

```typescript
// frontend/src/lib/api.ts
// ─────────────────────────────────────────────────────────────────────────────
// DEMO BRANCH WIRING — replaces the real network layer with an in-browser mock.
// Signatures are identical to production so every hook/component is unchanged.
// There is no Worker; auth (Supabase magic-link) still gates the UI separately.
// ─────────────────────────────────────────────────────────────────────────────
import { route } from "./demo/router";
import { urlFor } from "./demo/media";
import { load } from "./demo/store";

// GET/POST/PATCH/DELETE with an optional JSON body, served by the demo router.
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : undefined;
  return route(method, path, body) as T;
}

// Multipart uploads (media) — pass the FormData straight through.
export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  return route("POST", path, undefined, form) as T;
}

// Media file: resolve the in-memory blob URL (or a placeholder) for /api/media/:id/file.
export async function apiBlobUrl(path: string): Promise<string> {
  const match = path.match(/\/api\/media\/([^/]+)\/file/);
  if (!match) throw new Error(`400: not a media path: ${path}`);
  return urlFor(match[1]);
}

// "Download" endpoints (ZIP). In the demo we generate a small text manifest so the
// button works without a backend, rather than zipping real binaries.
export async function downloadAuthed(path: string, filename: string): Promise<void> {
  const text = buildManifest(path);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.zip$/, ".txt");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buildManifest(path: string): string {
  const db = load();
  const dayMatch = path.match(/\/api\/meeting-days\/([^/]+)\/zip/);
  if (dayMatch) {
    const day = db.meeting_days.find((d) => d.id === dayMatch[1]);
    if (!day) return "Meeting day not found (demo).";
    const reqs = db.meeting_requirements.filter((r) => r.meeting_day_id === day.id && r.active === 1);
    const present = db.attendance.filter((a) => a.meeting_day_id === day.id && a.present === 1)
      .map((a) => db.members.find((m) => m.id === a.member_id)?.name).filter(Boolean);
    const subs = db.submissions.filter((s) => s.meeting_day_id === day.id);
    const lines = [
      `Meeting day ${day.date}${day.title ? ` (${day.title})` : ""}`,
      "",
      "## Requirements",
      ...reqs.map((r) => `- ${r.label}${r.compulsory ? "" : " (optional)"}`),
      "",
      "## Attendance (present)",
      ...present.map((n) => `- ${n}`),
      "",
      "## Submissions",
      ...subs.map((s) => `- [${s.kind}]${s.subsystem ? ` (${s.subsystem})` : ""} ${s.content ?? ""}`),
      "",
      "(Demo export — media files are omitted.)",
    ];
    return lines.join("\n");
  }
  // /api/export/all-media/zip
  return `Demo media export\n\n${db.media.length} media item(s) recorded.\n(Demo export — binaries are omitted.)`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS. If `src/lib/hooks/useMembers.test.ts` mocks `./api`, it remains valid. Fix any test that asserted the removed fetch/token internals; do not weaken behavior tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(demo): delegate api layer to in-browser router"
```

---

### Task 8: Reset UI badge

**Files:**
- Create: `frontend/src/ui/DemoBadge.tsx`
- Modify: `frontend/src/App.tsx` (render the badge inside the authenticated shell)

- [ ] **Step 1: Write the DemoBadge component**

```tsx
// frontend/src/ui/DemoBadge.tsx
// Fixed "DEMO" pill with a reset action. Clearing the store and reloading
// restores the seeded sample data.
import { reset } from "../lib/demo/store";

export function DemoBadge() {
  const onReset = () => {
    if (!confirm("Reset the demo to its original sample data? Your changes in this browser will be cleared.")) return;
    reset();
    location.reload();
  };
  return (
    <div style={{ position: "fixed", bottom: 14, right: 14, zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      background: "var(--ink-1)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 10px 6px 12px", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
      <span className="mono-label" style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--maroon-bright)" }}>● DEMO</span>
      <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={onReset} title="Restore sample data">Reset</button>
    </div>
  );
}
```

- [ ] **Step 2: Render the badge in the authenticated shell**

In `frontend/src/App.tsx`, add the import near the other UI imports (after line 12, the `./ui/primitives` import):

```tsx
import { DemoBadge } from "./ui/DemoBadge";
```

Then render it inside `Shell()` so it shows only when signed in. Replace the desktop `return (` block opener at line 67 (`return (`) and the mobile one at line 100 — simplest: wrap by adding `<DemoBadge />` just before each closing of the top-level container. Concretely, in the **desktop** branch change the final `</div>` of the outer `<div className="tq" ...>` to include the badge, and the same for mobile. The minimal edit: insert `<DemoBadge />` immediately after the opening `<div className="tq"` container in BOTH branches.

Desktop branch — change:
```tsx
      <div className="tq" style={{ height: "100vh", display: "flex" }}>
        <aside ...>
```
to:
```tsx
      <div className="tq" style={{ height: "100vh", display: "flex" }}>
        <DemoBadge />
        <aside ...>
```

Mobile branch — change:
```tsx
    <div className="tq" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <header ...>
```
to:
```tsx
    <div className="tq" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <DemoBadge />
      <header ...>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/ui/DemoBadge.tsx frontend/src/App.tsx
git commit -m "feat(demo): DEMO badge with reset control"
```

---

### Task 9: Branch docs + manual verification

**Files:**
- Create: `DEMO.md`

- [ ] **Step 1: Write DEMO.md**

```markdown
# WeekLog — Demo build

This is the `demo` branch: a fully interactive clone of WeekLog with **no backend**.

- **Auth is real:** sign in with the Supabase email magic-link (your Gmail works).
- **Data is local:** all app data is seeded sample data stored in your browser's
  localStorage. Anything you change (attendance, entries, members, deadlines)
  persists in your browser only. Use the **Reset** button (bottom-right DEMO pill)
  to restore the original sample.
- **Everyone is an admin** so you can explore every feature.

## Known demo simplifications

- **Uploaded media:** the file metadata persists, but the image itself is held in
  memory for the session only. After a refresh, an uploaded image shows a
  placeholder. Seeded sample media always render.
- **ZIP / Drive export:** the ZIP buttons download a small text manifest (no real
  files are zipped). Google Drive export shows as "not configured."

## Running locally

```bash
cd frontend
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (no VITE_API_BASE)
npm install
npm run dev
```

## Deploying

Deploy this branch as a separate Cloudflare Pages project. Build needs only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Add the deployed URL to the
Supabase Auth **Site URL / redirect allow-list** so magic-link sign-in lands back
on the demo.
```

- [ ] **Step 2: Manual smoke test**

Run: `cd frontend && npm run dev`
Then in the browser, with Supabase env set, sign in and verify:
- Dashboard shows a red/amber overall with flagged days and upcoming deadlines.
- Calendar shows a spread of green/red/amber days; opening a day shows the requirement checklist.
- In a meeting day, the attendance tracker lists **member names** (committee shown small beneath); toggling present updates and persists across refresh.
- Adding a text entry flips its requirement to "Submitted" and can turn the day green.
- Members, Requirements (templates), Deadlines, Browse/search all load and mutate.
- The DEMO pill's **Reset** restores the original sample.

- [ ] **Step 3: Commit docs**

```bash
git add DEMO.md
git commit -m "docs(demo): branch readme + simplifications"
```

- [ ] **Step 4: Push the branch**

Run:
```bash
git push -u origin demo
```
Expected: branch `demo` published to the same GitHub repo.

---

## Self-Review notes

- **Spec coverage:** §3 modules → Tasks 1–8; §4 endpoint surface → Task 6 router (incl. `/api/me`, `/api/drive/status`, `/api/build-needs`); §5 simplifications → Task 7 (ZIP manifest, media placeholder) + Task 9 docs; §6 deployment → Task 9; §7 testing → Tasks 2/3/4/6/7.
- **No real backend touched:** all work is additive under `frontend/src/lib/demo/` plus the two swapped wiring files, on the `demo` branch only. `master` is untouched.
- **Type consistency:** router return shapes match `frontend/src/lib/hooks/types.ts` (e.g. `AttendanceRow {member_id,name,committees,present}`, `MeetingDayDetail`, `Dashboard`, `Deadline.status_rag`). Compute names (`deriveDay`, `dayStatusFromDerived`, `deadlineRag`) are reused consistently across tasks.
```
