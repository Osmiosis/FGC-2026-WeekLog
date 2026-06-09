# Per-Meeting Editable Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin deviate a single meeting's requirements from the default template set — toggle compulsory ↔ voluntary, remove, re-add a default, or add a custom one-off — after the meeting exists, without touching global templates or other meetings.

**Architecture:** `meeting_requirements` is already the per-meeting snapshot of each requirement, so we make those rows editable in place. Two new columns (`active` for soft-remove, `custom` for one-offs) plus four admin routes on the existing `meetingDays` router. RAG status recomputes for free because `dayStatus.ts` already reads `compulsory`/`status` off these rows. Frontend wiring goes in the protected `src/lib` seam; the `MeetingDayDetail` component gets admin-only edit affordances.

**Tech Stack:** Cloudflare Worker (Hono) + D1 (SQLite), Vitest with a better-sqlite3 shim, React + Vite + TypeScript frontend, Supabase auth.

**Spec:** `docs/superpowers/specs/2026-06-10-per-meeting-requirements-design.md`

---

## File Structure

**Worker (backend):**
- `worker/migrations/0006_meeting_requirements_editable.sql` — **create** — adds `active` + `custom` columns.
- `worker/test/helpers/d1.ts` — **modify** — load the new migration in the in-memory test DB.
- `worker/src/status.ts` — **modify** — carry `custom` through `ReqRow`.
- `worker/src/dayStatus.ts` — **modify** — `deriveDay` selects `custom` and filters `active=1`.
- `worker/src/routes/meetingDays.ts` — **modify** — four new admin routes.
- `worker/test/meetingRequirements.test.ts` — **create** — all new route tests.

**Frontend:**
- `frontend/src/lib/hooks/types.ts` — **modify** — add `custom` to `Requirement`, add `AvailableRequirement`.
- `frontend/src/lib/hooks/useMeetingDay.ts` — **modify** — add `toggleCompulsory`, `removeRequirement`, `addRequirement`, `loadAvailable`.
- `frontend/src/calendar/MeetingDayDetail.tsx` — **modify** — admin-only toggle/remove per card + "Add requirement" panel.

**Note on TDD scope:** Backend tasks (1–4) are full red→green TDD. Frontend tasks (5–6) have no component test harness in this project (only 4 smoke tests exist), so they are verified by `tsc` typecheck + production build, matching the existing project reality.

---

## Task 1: DB migration + plumb `custom`/`active` through reads

**Files:**
- Create: `worker/migrations/0006_meeting_requirements_editable.sql`
- Modify: `worker/test/helpers/d1.ts:48-52`
- Modify: `worker/src/status.ts:12-18`
- Modify: `worker/src/dayStatus.ts:13-15`
- Test: `worker/test/meetingRequirements.test.ts`

- [ ] **Step 1: Write the migration**

Create `worker/migrations/0006_meeting_requirements_editable.sql`:

```sql
-- Per-meeting requirement editing. `active=0` soft-removes a requirement from a
-- meeting's checklist (keeping any linked media/submissions). `custom=1` marks a
-- one-off requirement that is not backed by a template.
ALTER TABLE meeting_requirements ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meeting_requirements ADD COLUMN custom INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Load the migration in the test DB**

In `worker/test/helpers/d1.ts`, inside `makeTestDb()`, add the new migration after the `0004` line (line 51):

```javascript
  db.exec(sqlFile("../../migrations/0004_submission_resolved.sql"));
  db.exec(sqlFile("../../migrations/0006_meeting_requirements_editable.sql"));
  db.exec(sqlFile("../../seed/roster.sql"));
```

(Note: `0005_media_bytes.sql` is intentionally not loaded by this helper today — leave that as-is; `0006` only touches `meeting_requirements` from `0001`.)

- [ ] **Step 3: Carry `custom` through the requirement row type**

In `worker/src/status.ts`, add `custom` to the `ReqRow` interface (after line 16, `expected_kind`):

```typescript
export interface ReqRow {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
  status: string;
  custom: number;
}
```

- [ ] **Step 4: Select `custom` and filter `active=1` in deriveDay**

In `worker/src/dayStatus.ts`, replace the requirements query (lines 13-15) with:

```typescript
  const reqs = await env.DB.prepare(
    "SELECT id, label, compulsory, expected_kind, status, custom FROM meeting_requirements WHERE meeting_day_id=? AND active=1 ORDER BY compulsory DESC, label"
  )
```

- [ ] **Step 5: Write the failing test**

Create `worker/test/meetingRequirements.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth, D1Shim } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

// Mark a day and return its id.
async function mark(env: unknown, date: string): Promise<string> {
  const res = await app.request(
    "/api/meeting-days",
    { method: "POST", headers: ADMIN, body: JSON.stringify({ date }) },
    env as never
  );
  const created = (await res.json()) as { id: string };
  return created.id;
}

// Fetch a day's requirement checklist.
async function getReqs(env: unknown, id: string) {
  const res = await app.request(`/api/meeting-days/${id}`, { headers: ADMIN }, env as never);
  const day = (await res.json()) as {
    requirements: Array<{ id: string; label: string; compulsory: number; status: string; custom: number; expected_kind: string | null }>;
  };
  return day.requirements;
}

describe("per-meeting requirement editing", () => {
  let db: D1Shim;
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    db = makeTestDb();
    env = testEnv(db);
  });

  it("snapshots requirements as active=1, custom=0 by default", async () => {
    const id = await mark(env, "2026-07-07");
    const row = await db
      .prepare("SELECT active, custom FROM meeting_requirements WHERE meeting_day_id=? LIMIT 1")
      .bind(id)
      .first<{ active: number; custom: number }>();
    expect(row?.active).toBe(1);
    expect(row?.custom).toBe(0);
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: PASS (1 test). The migration columns now exist and default correctly.

- [ ] **Step 7: Run the full worker suite for no regressions**

Run: `cd worker && npx vitest run`
Expected: all existing tests PASS (adding `custom` to the SELECT and `active=1` filter is transparent while all rows are active).

- [ ] **Step 8: Commit**

```bash
git add worker/migrations/0006_meeting_requirements_editable.sql worker/test/helpers/d1.ts worker/src/status.ts worker/src/dayStatus.ts worker/test/meetingRequirements.test.ts
git commit -m "feat(worker): add active/custom columns for per-meeting requirement editing"
```

---

## Task 2: PATCH — toggle compulsory ↔ voluntary

**Files:**
- Modify: `worker/src/routes/meetingDays.ts` (insert after the media routes, before the `/bulk` route at line 213)
- Test: `worker/test/meetingRequirements.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe` block in `worker/test/meetingRequirements.test.ts`:

```typescript
  it("toggles a requirement compulsory <-> voluntary and updates RAG", async () => {
    const id = await mark(env, "2026-07-07");
    const before = await getReqs(env, id);
    const target = before.find((r) => r.compulsory === 1 && r.expected_kind === "text");
    expect(target).toBeTruthy();

    const res = await app.request(
      `/api/meeting-days/${id}/requirements/${target!.id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(res.status).toBe(200);

    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target!.id)!.compulsory).toBe(0);
  });

  it("rejects a bad compulsory value (400) and a non-admin (403)", async () => {
    const id = await mark(env, "2026-07-07");
    const r = (await getReqs(env, id))[0];

    const bad = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 5 }) },
      env as never
    );
    expect(bad.status).toBe(400);

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "PATCH", headers: MEMBER, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });

  it("404s when the requirement does not belong to the day", async () => {
    const id = await mark(env, "2026-07-07");
    const res = await app.request(
      `/api/meeting-days/${id}/requirements/does-not-exist`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(res.status).toBe(404);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: FAIL — PATCH route does not exist (toggle test sees an unchanged value / non-200; 404 test may pass incidentally via Hono default but the toggle test fails).

- [ ] **Step 3: Implement the PATCH route**

In `worker/src/routes/meetingDays.ts`, insert this block immediately after the media POST handler closes (after line 211, before the `// Bulk-mark...` comment on line 213):

```typescript
// ---- Per-meeting requirement editing (admin) ----

const REQ_KINDS = new Set(["attendance", "text", "media", "any"]);

// Toggle a single requirement compulsory <-> voluntary for this meeting only.
meetingDays.patch("/:id/requirements/:reqId", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const reqId = c.req.param("reqId");
  const b = await c.req.json<{ compulsory?: number }>();
  if (b.compulsory !== 0 && b.compulsory !== 1) {
    return c.json({ error: "compulsory must be 0 or 1" }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT id FROM meeting_requirements WHERE id=? AND meeting_day_id=? AND active=1"
  )
    .bind(reqId, id)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare("UPDATE meeting_requirements SET compulsory=? WHERE id=?")
    .bind(b.compulsory, reqId)
    .run();
  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: PASS (toggle, 400/403, 404 tests all green).

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/meetingDays.ts worker/test/meetingRequirements.test.ts
git commit -m "feat(worker): PATCH route to toggle a meeting requirement compulsory/voluntary"
```

---

## Task 3: DELETE — soft-remove a requirement

**Files:**
- Modify: `worker/src/routes/meetingDays.ts` (after the PATCH route from Task 2)
- Test: `worker/test/meetingRequirements.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe` block in `worker/test/meetingRequirements.test.ts`:

```typescript
  it("soft-removes a requirement: it leaves the checklist but stays in the DB", async () => {
    const id = await mark(env, "2026-07-07");
    const before = await getReqs(env, id);
    const target = before[0];

    const res = await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(res.status).toBe(200);

    // Gone from the checklist...
    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target.id)).toBeUndefined();
    expect(after.length).toBe(before.length - 1);

    // ...but the row is still in the DB with active=0 (data preserved).
    const row = await db
      .prepare("SELECT active FROM meeting_requirements WHERE id=?")
      .bind(target.id)
      .first<{ active: number }>();
    expect(row?.active).toBe(0);
  });

  it("rejects soft-remove by a non-admin (403) and 404s an unknown requirement", async () => {
    const id = await mark(env, "2026-07-07");
    const r = (await getReqs(env, id))[0];

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "DELETE", headers: MEMBER },
      env as never
    );
    expect(forbidden.status).toBe(403);

    const missing = await app.request(
      `/api/meeting-days/${id}/requirements/nope`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(missing.status).toBe(404);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: FAIL — DELETE on `/:id/requirements/:reqId` route does not exist.

- [ ] **Step 3: Implement the DELETE route**

In `worker/src/routes/meetingDays.ts`, insert immediately after the PATCH route added in Task 2:

```typescript
// Soft-remove a requirement from this meeting. Keeps any linked media/submissions
// in the database; the requirement simply leaves the checklist and RAG count.
meetingDays.delete("/:id/requirements/:reqId", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const reqId = c.req.param("reqId");
  const row = await c.env.DB.prepare(
    "SELECT id FROM meeting_requirements WHERE id=? AND meeting_day_id=? AND active=1"
  )
    .bind(reqId, id)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare("UPDATE meeting_requirements SET active=0 WHERE id=?")
    .bind(reqId)
    .run();
  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/meetingDays.ts worker/test/meetingRequirements.test.ts
git commit -m "feat(worker): DELETE route to soft-remove a meeting requirement"
```

---

## Task 4: GET available + POST add (default re-add and custom one-off)

**Files:**
- Modify: `worker/src/routes/meetingDays.ts` (after the DELETE route from Task 3)
- Test: `worker/test/meetingRequirements.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe` block in `worker/test/meetingRequirements.test.ts`:

```typescript
  it("lists templates not currently on the meeting as available", async () => {
    const id = await mark(env, "2026-07-07");
    const target = (await getReqs(env, id)).find((r) => r.expected_kind === "media")!;

    // Initially no templates are available (all 9 are snapshotted).
    let res = await app.request(
      `/api/meeting-days/${id}/requirements/available`,
      { headers: ADMIN },
      env as never
    );
    expect(((await res.json()) as unknown[]).length).toBe(0);

    // Remove one; its template becomes available again.
    await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    res = await app.request(
      `/api/meeting-days/${id}/requirements/available`,
      { headers: ADMIN },
      env as never
    );
    const avail = (await res.json()) as Array<{ id: string; label: string }>;
    expect(avail.length).toBe(1);
  });

  it("re-adding a removed default reactivates the original row (no duplicate)", async () => {
    const id = await mark(env, "2026-07-07");
    const target = (await getReqs(env, id))[0];
    const templateId = (await db
      .prepare("SELECT template_id FROM meeting_requirements WHERE id=?")
      .bind(target.id)
      .first<{ template_id: string }>())!.template_id;

    await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    const res = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ templateId }) },
      env as never
    );
    expect(res.status).toBe(201);

    // Same row id is back (reactivated), not a fresh duplicate.
    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target.id)).toBeTruthy();
    const total = await db
      .prepare("SELECT COUNT(*) AS n FROM meeting_requirements WHERE meeting_day_id=? AND template_id=?")
      .bind(id, templateId)
      .first<{ n: number }>();
    expect(total?.n).toBe(1);
  });

  it("adds a custom one-off requirement (template_id NULL, custom=1)", async () => {
    const id = await mark(env, "2026-07-07");
    const res = await app.request(
      `/api/meeting-days/${id}/requirements`,
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ label: "Sponsor logo placement", compulsory: 1, expectedKind: "media" }),
      },
      env as never
    );
    expect(res.status).toBe(201);

    const after = await getReqs(env, id);
    const added = after.find((r) => r.label === "Sponsor logo placement");
    expect(added).toBeTruthy();
    expect(added!.compulsory).toBe(1);
    expect(added!.custom).toBe(1);
  });

  it("validates add input and gating", async () => {
    const id = await mark(env, "2026-07-07");

    const badKind = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ label: "x", expectedKind: "bogus" }) },
      env as never
    );
    expect(badKind.status).toBe(400);

    const empty = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({}) },
      env as never
    );
    expect(empty.status).toBe(400);

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ label: "x" }) },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: FAIL — GET `/available` and POST `/:id/requirements` routes do not exist.

- [ ] **Step 3: Implement the available + add routes**

In `worker/src/routes/meetingDays.ts`, insert immediately after the DELETE route added in Task 3:

```typescript
// Active templates not currently on this meeting — populates the "add default" picker.
meetingDays.get("/:id/requirements/available", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.label, t.compulsory, t.expected_kind
     FROM requirement_templates t
     WHERE t.active = 1
       AND NOT EXISTS (
         SELECT 1 FROM meeting_requirements r
         WHERE r.meeting_day_id = ? AND r.template_id = t.id AND r.active = 1
       )
     ORDER BY t.sort_order`
  )
    .bind(id)
    .all();
  return c.json(results);
});

// Add a requirement to this meeting: re-add a template default (reactivate a
// soft-removed snapshot, else snapshot fresh) or add a custom one-off.
meetingDays.post("/:id/requirements", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{
    templateId?: string;
    label?: string;
    compulsory?: number;
    expectedKind?: string;
  }>();

  const day = await c.env.DB.prepare("SELECT id FROM meeting_days WHERE id=?").bind(id).first();
  if (!day) return c.json({ error: "not found" }, 404);

  if (b.templateId) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM meeting_requirements WHERE meeting_day_id=? AND template_id=?"
    )
      .bind(id, b.templateId)
      .first<{ id: string }>();
    if (existing) {
      await c.env.DB.prepare("UPDATE meeting_requirements SET active=1 WHERE id=?")
        .bind(existing.id)
        .run();
    } else {
      const t = await c.env.DB.prepare(
        "SELECT label, compulsory, expected_kind FROM requirement_templates WHERE id=? AND active=1"
      )
        .bind(b.templateId)
        .first<{ label: string; compulsory: number; expected_kind: string | null }>();
      if (!t) return c.json({ error: "template not found" }, 404);
      await c.env.DB.prepare(
        "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status, active, custom) VALUES (?, ?, ?, ?, ?, ?, 'missing', 1, 0)"
      )
        .bind(crypto.randomUUID(), id, b.templateId, t.label, t.compulsory, t.expected_kind)
        .run();
    }
  } else if (b.label) {
    const kind = b.expectedKind ?? "any";
    if (!REQ_KINDS.has(kind)) return c.json({ error: "invalid expectedKind" }, 400);
    const compulsory = b.compulsory ? 1 : 0;
    await c.env.DB.prepare(
      "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status, active, custom) VALUES (?, ?, NULL, ?, ?, ?, 'missing', 1, 1)"
    )
      .bind(crypto.randomUUID(), id, b.label, compulsory, kind)
      .run();
  } else {
    return c.json({ error: "templateId or label required" }, 400);
  }

  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements }, 201);
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd worker && npx vitest run meetingRequirements`
Expected: PASS (all per-meeting requirement tests green).

- [ ] **Step 5: Run the full worker suite**

Run: `cd worker && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/meetingDays.ts worker/test/meetingRequirements.test.ts
git commit -m "feat(worker): GET available templates + POST add (re-add default or custom requirement)"
```

---

## Task 5: Frontend seam — types + hook mutations

**Files:**
- Modify: `frontend/src/lib/hooks/types.ts:30-36`
- Modify: `frontend/src/lib/hooks/useMeetingDay.ts`

- [ ] **Step 1: Extend the Requirement type and add AvailableRequirement**

In `frontend/src/lib/hooks/types.ts`, replace the `Requirement` interface (lines 30-36) with:

```typescript
export interface Requirement {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
  status: "submitted" | "missing";
  custom: number;
}

export interface AvailableRequirement {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
}
```

- [ ] **Step 2: Add the mutations to the hook**

In `frontend/src/lib/hooks/useMeetingDay.ts`:

First extend the type import (line 4):

```typescript
import type { MeetingDayDetail, AttendanceRow, Submission, MediaRow, AvailableRequirement } from "./types";
```

Then add these functions just before the `unmark` function (line 77):

```typescript
  const toggleCompulsory = async (reqId: string, compulsory: number) => {
    await api(`/api/meeting-days/${dayId}/requirements/${reqId}`, {
      method: "PATCH",
      body: JSON.stringify({ compulsory }),
    });
    reload();
  };

  const removeRequirement = async (reqId: string) => {
    await api(`/api/meeting-days/${dayId}/requirements/${reqId}`, { method: "DELETE" });
    reload();
  };

  const addRequirement = async (
    input:
      | { templateId: string }
      | { label: string; compulsory: number; expectedKind: string }
  ) => {
    await api(`/api/meeting-days/${dayId}/requirements`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    reload();
  };

  const loadAvailable = useCallback(
    (): Promise<AvailableRequirement[]> =>
      api<AvailableRequirement[]>(`/api/meeting-days/${dayId}/requirements/available`),
    [dayId]
  );
```

Then add them to the returned object (inside the `return { ... }` at line 84):

```typescript
  return {
    detail,
    attendance,
    submissions,
    media,
    error,
    reload,
    setPresent,
    addSubmission,
    uploadMedia,
    toggleCompulsory,
    removeRequirement,
    addRequirement,
    loadAvailable,
    unmark,
    downloadZip,
  };
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (`useCallback` is already imported in this file.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/hooks/types.ts frontend/src/lib/hooks/useMeetingDay.ts
git commit -m "feat(frontend): seam mutations for per-meeting requirement editing"
```

---

## Task 6: Frontend UI — admin toggle/remove per card + Add panel

**Files:**
- Modify: `frontend/src/calendar/MeetingDayDetail.tsx`

- [ ] **Step 1: Pass admin + handlers into RequirementCard**

In `frontend/src/calendar/MeetingDayDetail.tsx`, replace the destructure on line 25 with:

```typescript
  const { detail, attendance, submissions, media, error, setPresent, addSubmission, uploadMedia, toggleCompulsory, removeRequirement, addRequirement, loadAvailable } = day;
```

Then replace the requirements map (lines 65-78) with one that passes admin controls and renders the Add panel beneath:

```typescript
      {detail.requirements.map((r) => (
        <RequirementCard
          key={r.id}
          req={r}
          isAdmin={isAdmin}
          attendance={attendance}
          onSetPresent={setPresent}
          onAddText={(content, subsystem) =>
            addSubmission({ kind: kindForLabel(r.label), content, requirementId: r.id, subsystem })
          }
          onUpload={(file, kind, caption) =>
            uploadMedia({ file, kind, caption, requirementId: r.id })
          }
          onToggleCompulsory={() => toggleCompulsory(r.id, r.compulsory ? 0 : 1)}
          onRemove={() => {
            if (confirm(`Remove "${r.label}" from this meeting? Uploaded files are kept.`)) {
              removeRequirement(r.id);
            }
          }}
        />
      ))}

      {isAdmin && <AddRequirement onAdd={addRequirement} loadAvailable={loadAvailable} />}
```

- [ ] **Step 2: Add admin controls inside RequirementCard**

In `frontend/src/calendar/MeetingDayDetail.tsx`, replace the entire `RequirementCard` function (lines 85-129) with:

```typescript
function RequirementCard({
  req,
  isAdmin,
  attendance,
  onSetPresent,
  onAddText,
  onUpload,
  onToggleCompulsory,
  onRemove,
}: {
  req: Requirement;
  isAdmin: boolean;
  attendance: AttendanceRow[];
  onSetPresent: (memberId: string, present: number) => void;
  onAddText: (content: string, subsystem?: string) => void;
  onUpload: (file: File, kind: string, caption: string) => void;
  onToggleCompulsory: () => void;
  onRemove: () => void;
}) {
  const submitted = req.status === "submitted";
  const border = submitted ? "#b4e0b8" : req.compulsory ? "#f3b4b4" : "#ddd";

  return (
    <div style={{ border: `1px solid ${border}`, borderLeft: `6px solid ${border}`, padding: 12, margin: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>
          {req.label} {req.compulsory ? "" : "(optional)"}
          {req.custom ? <span style={{ color: "#888", fontWeight: 400 }}> · custom</span> : ""}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{submitted ? "submitted" : "missing"}</span>
          {isAdmin && (
            <>
              <button
                onClick={onToggleCompulsory}
                title="Toggle whether this requirement is compulsory for this meeting"
                style={{ fontSize: 12 }}
              >
                Make {req.compulsory ? "voluntary" : "compulsory"}
              </button>
              <button onClick={onRemove} title="Remove from this meeting" style={{ fontSize: 12, color: "crimson" }}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {req.expected_kind === "attendance" && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
          {attendance.map((a) => (
            <label key={a.member_id} style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!a.present}
                onChange={(e) => onSetPresent(a.member_id, e.target.checked ? 1 : 0)}
              />{" "}
              {a.name}
            </label>
          ))}
        </div>
      )}

      {req.expected_kind === "text" && <TextSubmit onAdd={onAddText} />}
      {req.expected_kind === "media" && <MediaUpload onUpload={onUpload} />}
    </div>
  );
}
```

- [ ] **Step 3: Add the AddRequirement panel component**

In `frontend/src/calendar/MeetingDayDetail.tsx`, add the `AvailableRequirement` type to the existing type import (lines 6-11):

```typescript
import type {
  Requirement,
  AvailableRequirement,
  AttendanceRow,
  Submission,
  MediaRow,
} from "../lib/hooks/types";
```

Then add this new component just before the `Existing` function (line 192):

```typescript
const REQ_KINDS = ["text", "media", "attendance", "any"];

function AddRequirement({
  onAdd,
  loadAvailable,
}: {
  onAdd: (
    input: { templateId: string } | { label: string; compulsory: number; expectedKind: string }
  ) => Promise<void>;
  loadAvailable: () => Promise<AvailableRequirement[]>;
}) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableRequirement[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [compulsory, setCompulsory] = useState(true);
  const [busy, setBusy] = useState(false);

  const openPanel = async () => {
    setOpen(true);
    setAvailable(await loadAvailable());
  };

  const submitTemplate = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      await onAdd({ templateId });
      setTemplateId("");
      setAvailable(await loadAvailable());
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onAdd({ label: label.trim(), compulsory: compulsory ? 1 : 0, expectedKind: kind });
      setLabel("");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={openPanel} style={{ marginTop: 12 }}>
        + Add requirement
      </button>
    );
  }

  return (
    <div style={{ border: "1px dashed #bbb", padding: 12, margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Add requirement</strong>
        <button onClick={() => setOpen(false)} style={{ fontSize: 12 }}>
          Close
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>From the default templates</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">
              {available.length ? "Choose a template..." : "(none available)"}
            </option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.compulsory ? "" : " (optional)"}
              </option>
            ))}
          </select>
          <button onClick={submitTemplate} disabled={!templateId || busy}>
            Add default
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Or a custom one-off</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Requirement label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {REQ_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={compulsory} onChange={(e) => setCompulsory(e.target.checked)} />{" "}
            compulsory
          </label>
          <button onClick={submitCustom} disabled={!label.trim() || busy}>
            Add custom
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Production build**

Run: `cd frontend && npm run build`
Expected: build succeeds (tsc + vite).

- [ ] **Step 6: Manual smoke (optional but recommended)**

Start the dev servers (`cd worker && npx wrangler dev` on 8787; `cd frontend && npm run dev` on 5173), sign in as admin, open a meeting day, and verify: each card shows "Make voluntary/compulsory" + "Remove"; removing drops the card; "+ Add requirement" lists removed/unused templates and adds a custom one-off. Sign in as a member and verify none of these controls appear.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/calendar/MeetingDayDetail.tsx
git commit -m "feat(frontend): admin per-meeting requirement editing UI (toggle/remove/add)"
```

---

## Self-Review Notes

- **Spec coverage:** toggle (Task 2), remove (Task 3), re-add default + custom one-off + available picker (Task 4), soft-delete semantics (Task 3, `active=0` with DB-preserved row asserted), admin-only gating (403 tests in Tasks 2–4; `isAdmin` guard in Task 6), frozen-snapshot compatibility (existing `meetingDays.test.ts` re-run in Task 1/4). All spec sections map to tasks.
- **Type consistency:** `Requirement.custom`, `ReqRow.custom`, and the SQL `custom` column are consistent across worker and frontend. Hook method names (`toggleCompulsory`, `removeRequirement`, `addRequirement`, `loadAvailable`) match exactly between Task 5 (definition) and Task 6 (usage). `AvailableRequirement` shape matches the GET `/available` SELECT.
- **No placeholders:** every code step contains complete, runnable code.
