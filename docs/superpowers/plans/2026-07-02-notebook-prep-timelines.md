# Notebook Prep (Slice B: Timelines) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notebook Prep view to WeekLog whose Timeline tab shows the team's logged season as per-subsystem chronological arcs, published through an admin-generated snapshot plus teammate refresh requests.

**Architecture:** A shared JSON contract in the `@weeklog/types` workspace is imported (type-only) by both worker and frontend. The worker computes the deterministic `TimelinePayload` from D1 on an admin trigger and stores one snapshot row per report kind; teammates queue refresh requests that the admin fulfils. The frontend reads the latest snapshot per kind and renders the Timeline tab in its own style.

**Tech Stack:** Cloudflare Workers + Hono + D1 (worker), React 18 + Vite (frontend), TypeScript, vitest (both), better-sqlite3 test shim.

## Global Constraints

- No em dashes anywhere in code, UI copy, comments, or docs (standing WeekLog rule).
- No runtime LLM API calls; the timeline is deterministic Worker compute.
- Photos travel as metadata only (caption, kind). Never read image bytes in this feature.
- IDs: `crypto.randomUUID()`. Timestamps: `new Date().toISOString()`.
- Shared types live once in `@weeklog/types` (`types/src/`) and are imported type-only by both apps so the contract cannot drift.
- Auth: reads and request-creation use `requireUser` (open-access, attaches an anonymous member when unauthenticated). Generation uses `requireAdmin` (the configured `ADMIN_EMAIL`, `vibha.aarav@gmail.com`).
- Timeline entry kinds use the DB-native submission values, including `performance_goal` (not `goal`), so entries stay verbatim and need no remapping.

---

### Task 1: Shared notebook types in `@weeklog/types`

**Files:**
- Create: `types/src/notebook.ts`
- Modify: `types/src/index.ts` (append one re-export line)
- Modify: `worker/package.json` (add dependency line)
- Modify: `frontend/package.json` (add dependency line)

**Interfaces:**
- Produces: `ReportKind`, `TimelineEntryKind`, `TimelineEntry`, `TimelineSubsystem`, `TimelinePhotoDay`, `TimelinePayload`, `NotebookReport`, `ReportRequest`, `NotebookReportsMap`, `PendingRequestSummary` (all from `@weeklog/types`).

- [ ] **Step 1: Write the types file**

Create `types/src/notebook.ts`:

```ts
// Notebook Prep pipeline: the shared JSON contract between the worker (which
// produces reports) and the frontend (which renders them). Defined once here so
// the two sides cannot drift out of sync.

export type ReportKind = "timeline" | "gaps" | "decisions" | "scaffold";

// DB-native submission kinds that carry notebook content. Verbatim, no remapping.
export type TimelineEntryKind =
  | "accomplishment"
  | "failure"
  | "build_need"
  | "performance_goal"
  | "note";

export interface TimelineEntry {
  date: string; // YYYY-MM-DD
  kind: TimelineEntryKind;
  text: string; // the team's own logged words, verbatim
  created_by: string | null;
}

export interface TimelineSubsystem {
  name: string; // "Shooter", "Drivetrain/Collector", "Uncategorized", ...
  entries: TimelineEntry[];
}

export interface TimelinePhotoDay {
  date: string; // YYYY-MM-DD
  photos: Array<{ caption: string; kind: string }>; // metadata only, no bytes
}

export interface TimelinePayload {
  subsystems: TimelineSubsystem[];
  photosByDate: TimelinePhotoDay[];
}

// Widens as later report kinds land (gaps, decisions, scaffold).
export type ReportPayload = TimelinePayload;

export interface NotebookReport {
  id: string;
  kind: ReportKind;
  generated_at: string; // ISO
  payload: ReportPayload;
}

export type ReportRequestStatus = "pending" | "fulfilled";

export interface ReportRequest {
  id: string;
  kind: ReportKind;
  requested_by: string;
  requested_at: string; // ISO
  status: ReportRequestStatus;
  fulfilled_at: string | null;
}

// GET /api/notebook/reports response: latest report per kind (absent kinds omitted).
export type NotebookReportsMap = Partial<Record<ReportKind, NotebookReport>>;

// GET /api/notebook/requests response: one summary row per kind with pending requests.
export interface PendingRequestSummary {
  kind: ReportKind;
  count: number;
  latest_requested_at: string;
}
```

- [ ] **Step 2: Re-export from the package entry**

Append to `types/src/index.ts`:

```ts
export * from "./notebook";
```

- [ ] **Step 3: Declare the dependency in both apps**

In `worker/package.json` and `frontend/package.json`, add to the `"dependencies"` object:

```json
"@weeklog/types": "*"
```

(The workspace symlink `node_modules/@weeklog/types` already exists, so no reinstall is needed for type-only resolution under `moduleResolution: "Bundler"`.)

- [ ] **Step 4: Typecheck the workspaces**

Run: `npm run typecheck`
Expected: PASS for `@weeklog/types`, `@weeklog/worker`, `@weeklog/frontend` (no resolution errors for `@weeklog/types`).

- [ ] **Step 5: Commit**

```bash
git add types/src/notebook.ts types/src/index.ts worker/package.json frontend/package.json
git commit -m "feat(types): shared Notebook Prep report contract"
```

---

### Task 2: Migration + test harness wiring

**Files:**
- Create: `worker/migrations/0008_notebook.sql`
- Modify: `worker/test/helpers/d1.ts` (add one `db.exec(...)` line)
- Test: `worker/test/notebook.test.ts` (new; first test only)

**Interfaces:**
- Produces: tables `notebook_reports` (unique `kind`) and `notebook_requests`.

- [ ] **Step 1: Write the migration**

Create `worker/migrations/0008_notebook.sql`:

```sql
-- Notebook Prep: one published snapshot per report kind (latest wins), plus
-- teammate refresh requests that await an admin-triggered regenerate.
CREATE TABLE notebook_reports (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL UNIQUE,
  generated_at TEXT NOT NULL,
  payload      TEXT NOT NULL
);

CREATE TABLE notebook_requests (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  requested_by TEXT,
  requested_at TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  fulfilled_at TEXT
);

CREATE INDEX idx_notebook_requests_kind_status ON notebook_requests(kind, status);
```

- [ ] **Step 2: Wire the migration into the test DB**

In `worker/test/helpers/d1.ts`, inside `makeTestDb()`, add after the `0007_committees.sql` line:

```ts
  db.exec(sqlFile("../../migrations/0008_notebook.sql"));
```

- [ ] **Step 3: Write the failing smoke test**

Create `worker/test/notebook.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

describe("notebook prep", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("starts with no reports", async () => {
    const res = await app.request("/api/notebook/reports", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (route `/api/notebook/reports` returns 404; no notebook router mounted yet).

- [ ] **Step 5: Commit the migration and harness**

```bash
git add worker/migrations/0008_notebook.sql worker/test/helpers/d1.ts worker/test/notebook.test.ts
git commit -m "feat(db): notebook_reports + notebook_requests tables"
```

---

### Task 3: Notebook router skeleton + GET /reports + mount

**Files:**
- Create: `worker/src/routes/notebook.ts`
- Modify: `worker/src/index.ts` (import + mount)
- Test: `worker/test/notebook.test.ts` (the Task 2 smoke test now passes)

**Interfaces:**
- Consumes: `requireUser`, `requireAdmin` from `../auth`; `Env`, `Variables` from `../bindings`; types from `@weeklog/types`.
- Produces: `export const notebook` Hono router; `GET /reports` returning `NotebookReportsMap`.

- [ ] **Step 1: Write the router with GET /reports**

Create `worker/src/routes/notebook.ts`:

```ts
import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind } from "@weeklog/types";

// Notebook Prep API (mounted at /api/notebook).
export const notebook = new Hono<{ Bindings: Env; Variables: Variables }>();

// Latest published snapshot per kind. The view renders whatever is here; it does
// not care whether a row was computed (timeline) or authored offline (later kinds).
notebook.get("/reports", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, kind, generated_at, payload FROM notebook_reports"
  ).all<{ id: string; kind: string; generated_at: string; payload: string }>();

  const map: NotebookReportsMap = {};
  for (const r of results) {
    map[r.kind as ReportKind] = {
      id: r.id,
      kind: r.kind as ReportKind,
      generated_at: r.generated_at,
      payload: JSON.parse(r.payload),
    } as NotebookReport;
  }
  return c.json(map);
});
```

- [ ] **Step 2: Mount the router**

In `worker/src/index.ts`, add the import next to the other route imports:

```ts
import { notebook } from "./routes/notebook";
```

and add the mount next to the other `app.route(...)` lines:

```ts
app.route("/api/notebook", notebook);
```

- [ ] **Step 3: Run the smoke test to verify it passes**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS ("starts with no reports").

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/notebook.ts worker/src/index.ts
git commit -m "feat(notebook): router + GET /reports, mounted at /api/notebook"
```

---

### Task 4: Refresh requests (POST + GET /requests)

**Files:**
- Modify: `worker/src/routes/notebook.ts`
- Test: `worker/test/notebook.test.ts`

**Interfaces:**
- Consumes: `notebook` router from Task 3.
- Produces: `POST /requests` (body `{ kind: ReportKind }`) and `GET /requests` returning `PendingRequestSummary[]`.

- [ ] **Step 1: Write the failing test**

Append to `worker/test/notebook.test.ts` inside the `describe`:

```ts
  it("lets a member queue a refresh request the admin can see", async () => {
    const post = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "timeline" }) },
      env as never
    );
    expect(post.status).toBe(200);

    const list = await app.request("/api/notebook/requests", { headers: ADMIN }, env as never);
    const summary = (await list.json()) as { kind: string; count: number; latest_requested_at: string }[];
    expect(summary).toEqual([{ kind: "timeline", count: 1, latest_requested_at: expect.any(String) }]);
  });

  it("rejects an unknown request kind", async () => {
    const res = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "bogus" }) },
      env as never
    );
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (POST/GET `/requests` return 404).

- [ ] **Step 3: Implement the request routes**

Append to `worker/src/routes/notebook.ts` (after the imports, add the constant; after the `/reports` route, add the two routes):

```ts
const KINDS: ReportKind[] = ["timeline", "gaps", "decisions", "scaffold"];
```

```ts
// A member asks for a report kind to be refreshed. The request sits pending until
// an admin regenerates that kind.
notebook.post("/requests", requireUser, async (c) => {
  const body = await c.req.json<{ kind?: string }>();
  if (!body.kind || !KINDS.includes(body.kind as ReportKind)) {
    return c.json({ error: "unknown kind" }, 400);
  }
  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO notebook_requests (id, kind, requested_by, requested_at, status) VALUES (?, ?, ?, ?, 'pending')"
  )
    .bind(crypto.randomUUID(), body.kind, user.email, new Date().toISOString())
    .run();
  return c.json({ ok: true });
});

// Pending requests grouped by kind, for the admin indicator.
notebook.get("/requests", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT kind, COUNT(*) AS count, MAX(requested_at) AS latest_requested_at
     FROM notebook_requests WHERE status = 'pending' GROUP BY kind ORDER BY kind`
  ).all<{ kind: string; count: number; latest_requested_at: string }>();
  return c.json(results);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/notebook.ts worker/test/notebook.test.ts
git commit -m "feat(notebook): teammate refresh requests"
```

---

### Task 5: Admin generate/timeline (compute + upsert + fulfil requests)

**Files:**
- Modify: `worker/src/routes/notebook.ts`
- Test: `worker/test/notebook.test.ts`

**Interfaces:**
- Consumes: `notebook` router; `requireAdmin` from `../auth`; `TimelinePayload` from `@weeklog/types`.
- Produces: `POST /generate/timeline` (admin-only) that stores the `timeline` snapshot and marks pending `timeline` requests fulfilled.

- [ ] **Step 1: Write the failing test**

Append to `worker/test/notebook.test.ts` inside the `describe`. This seeds a day, submissions across subsystems (one with a null subsystem), and a photo, then generates:

```ts
  async function seedSeason() {
    const mk = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ date: "2026-07-07" }) },
      env as never
    );
    const dayId = ((await mk.json()) as { id: string }).id;
    const sub = (kind: string, subsystem: string | null, content: string) =>
      app.request(
        `/api/meeting-days/${dayId}/submissions`,
        { method: "POST", headers: MEMBER, body: JSON.stringify({ kind, subsystem, content }) },
        env as never
      );
    await sub("accomplishment", "Shooter", "Shooter tuned");
    await sub("failure", "Climber", "Hook slipped");
    await sub("note", null, "General note");
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }));
    await app.request(`/api/meeting-days/${dayId}/media`, { method: "POST", headers: MEMBER, body: form }, env as never);
    return dayId;
  }

  it("admin generate builds the timeline snapshot from logged data", async () => {
    await seedSeason();
    const gen = await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    expect(gen.status).toBe(200);

    const map = (await (await app.request("/api/notebook/reports", { headers: MEMBER }, env as never)).json()) as Record<
      string,
      { payload: { subsystems: { name: string; entries: { text: string; kind: string }[] }[]; photosByDate: { date: string; photos: unknown[] }[] } }
    >;
    const tl = map.timeline.payload;
    const names = tl.subsystems.map((s) => s.name);
    expect(names).toContain("Shooter");
    expect(names).toContain("Climber");
    expect(names).toContain("Uncategorized"); // the null-subsystem note lands here
    const shooter = tl.subsystems.find((s) => s.name === "Shooter")!;
    expect(shooter.entries[0]).toMatchObject({ text: "Shooter tuned", kind: "accomplishment" });
    expect(tl.photosByDate).toEqual([{ date: "2026-07-07", photos: [{ caption: "", kind: expect.any(String) }] }]);
  });

  it("generate is admin-only and fulfils pending timeline requests", async () => {
    await seedSeason();
    await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "timeline" }) },
      env as never
    );

    const forbidden = await app.request("/api/notebook/generate/timeline", { method: "POST", headers: MEMBER }, env as never);
    expect(forbidden.status).toBe(403);

    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    const pending = (await (await app.request("/api/notebook/requests", { headers: ADMIN }, env as never)).json()) as unknown[];
    expect(pending).toEqual([]); // the pending timeline request is now fulfilled
  });

  it("re-generating replaces the snapshot, not duplicates it", async () => {
    await seedSeason();
    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    const rows = (await (env.DB as { prepare: (s: string) => { all: () => Promise<{ results: unknown[] }> } })
      .prepare("SELECT id FROM notebook_reports WHERE kind='timeline'")
      .all()).results;
    expect(rows.length).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: FAIL (`/generate/timeline` returns 404).

- [ ] **Step 3: Implement generate/timeline**

Update the import line in `worker/src/routes/notebook.ts` to include `requireAdmin` and the `TimelinePayload` type:

```ts
import { requireUser, requireAdmin } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind, TimelinePayload, TimelineEntry } from "@weeklog/types";
```

Append the compute helper and route to `worker/src/routes/notebook.ts`:

```ts
// Deterministic: assemble per-subsystem chronological threads plus date-keyed
// meeting photos. Subsystem order follows the committees dimension; null-subsystem
// entries fall into "Uncategorized"; photos are metadata only (no bytes).
async function buildTimeline(env: Env): Promise<TimelinePayload> {
  const committees = (
    await env.DB.prepare("SELECT name FROM committees ORDER BY sort_order, name").all<{ name: string }>()
  ).results.map((r) => r.name);

  const subs = (
    await env.DB.prepare(
      `SELECT s.subsystem, s.kind, s.content, s.created_by, md.date
       FROM submissions s JOIN meeting_days md ON md.id = s.meeting_day_id
       WHERE s.kind IN ('accomplishment','failure','build_need','performance_goal','note')
       ORDER BY md.date, s.created_at`
    ).all<{ subsystem: string | null; kind: string; content: string | null; created_by: string | null; date: string }>()
  ).results;

  const bySub = new Map<string, TimelineEntry[]>();
  for (const s of subs) {
    const name = s.subsystem ?? "Uncategorized";
    const entry: TimelineEntry = {
      date: s.date,
      kind: s.kind as TimelineEntry["kind"],
      text: s.content ?? "",
      created_by: s.created_by,
    };
    const list = bySub.get(name);
    if (list) list.push(entry);
    else bySub.set(name, [entry]);
  }

  // Canonical committees first (only those with entries), then any stray or Uncategorized keys.
  const ordered: string[] = [];
  for (const name of committees) if (bySub.has(name)) ordered.push(name);
  for (const name of bySub.keys()) if (!ordered.includes(name)) ordered.push(name);
  const subsystems = ordered.map((name) => ({ name, entries: bySub.get(name)! }));

  const media = (
    await env.DB.prepare(
      `SELECT md.date, m.caption, m.kind
       FROM media m JOIN meeting_days md ON md.id = m.meeting_day_id
       ORDER BY md.date, m.uploaded_at`
    ).all<{ date: string; caption: string | null; kind: string | null }>()
  ).results;

  const byDate = new Map<string, { caption: string; kind: string }[]>();
  for (const m of media) {
    const photo = { caption: m.caption ?? "", kind: m.kind ?? "" };
    const list = byDate.get(m.date);
    if (list) list.push(photo);
    else byDate.set(m.date, [photo]);
  }
  const photosByDate = [...byDate.entries()].map(([date, photos]) => ({ date, photos }));

  return { subsystems, photosByDate };
}

// Admin-triggered: compute the timeline, upsert the single snapshot row for its
// kind, and mark all pending timeline requests fulfilled in one shot.
notebook.post("/generate/timeline", requireAdmin, async (c) => {
  const payload = await buildTimeline(c.env);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO notebook_reports (id, kind, generated_at, payload)
     VALUES (?, 'timeline', ?, ?)
     ON CONFLICT(kind) DO UPDATE SET id = excluded.id, generated_at = excluded.generated_at, payload = excluded.payload`
  )
    .bind(crypto.randomUUID(), now, JSON.stringify(payload))
    .run();
  await c.env.DB.prepare(
    "UPDATE notebook_requests SET status = 'fulfilled', fulfilled_at = ? WHERE kind = 'timeline' AND status = 'pending'"
  )
    .bind(now)
    .run();
  return c.json(payload);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/worker -- test/notebook.test.ts`
Expected: PASS (all notebook tests).

- [ ] **Step 5: Run the full worker suite for regressions**

Run: `npm run test --workspace @weeklog/worker`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/notebook.ts worker/test/notebook.test.ts
git commit -m "feat(notebook): admin generate/timeline snapshot + request fulfilment"
```

---

### Task 6: Frontend `useNotebook` hook

**Files:**
- Create: `frontend/src/lib/hooks/useNotebook.ts`
- Test: `frontend/src/lib/hooks/useNotebook.test.ts`

**Interfaces:**
- Consumes: `api` from `../api`; types from `@weeklog/types`.
- Produces: `useNotebook()` returning `{ timeline, reports, pending, error, busy, reload, generateTimeline, requestRefresh }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/hooks/useNotebook.test.ts` (mirrors the `useMembers` test's supabase mock + fetch stub):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../supabase", () => ({
  isConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      }),
      refreshSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
  },
}));

import { useNotebook } from "./useNotebook";

describe("useNotebook", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("loads the timeline report and posts a refresh request", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/reports")) {
        return new Response(
          JSON.stringify({ timeline: { id: "r1", kind: "timeline", generated_at: "2026-07-07T00:00:00Z", payload: { subsystems: [{ name: "Shooter", entries: [] }], photosByDate: [] } } }),
          { status: 200 }
        );
      }
      if (url.includes("/requests") && init?.method === "POST") return new Response("{}", { status: 200 });
      if (url.includes("/requests")) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotebook());
    await waitFor(() => expect(result.current.timeline?.subsystems[0].name).toBe("Shooter"));

    await act(async () => { await result.current.requestRefresh("timeline"); });
    const posted = fetchMock.mock.calls.find((c) => String(c[0]).includes("/requests") && (c[1] as RequestInit)?.method === "POST");
    expect(posted).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/lib/hooks/useNotebook.test.ts`
Expected: FAIL (module `./useNotebook` not found).

- [ ] **Step 3: Implement the hook**

Create `frontend/src/lib/hooks/useNotebook.ts`:

```ts
// Owns /api/notebook: reads the published report snapshots + pending requests,
// and exposes the admin generate + member refresh-request actions.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { NotebookReportsMap, PendingRequestSummary, ReportKind, TimelinePayload } from "@weeklog/types";

export function useNotebook() {
  const [reports, setReports] = useState<NotebookReportsMap>({});
  const [pending, setPending] = useState<PendingRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    api<NotebookReportsMap>("/api/notebook/reports").then(setReports).catch((e) => setError(String(e)));
    api<PendingRequestSummary[]>("/api/notebook/requests").then(setPending).catch(() => setPending([]));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const generateTimeline = async () => {
    setBusy(true);
    try {
      await api("/api/notebook/generate/timeline", { method: "POST" });
      reload();
    } finally {
      setBusy(false);
    }
  };

  const requestRefresh = async (kind: ReportKind) => {
    await api("/api/notebook/requests", { method: "POST", body: JSON.stringify({ kind }) });
    reload();
  };

  const timeline = (reports.timeline?.payload ?? null) as TimelinePayload | null;
  return { reports, timeline, pending, error, busy, reload, generateTimeline, requestRefresh };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/lib/hooks/useNotebook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/hooks/useNotebook.ts frontend/src/lib/hooks/useNotebook.test.ts
git commit -m "feat(notebook): useNotebook hook"
```

---

### Task 7: Timeline tab component

**Files:**
- Create: `frontend/src/notebook/TimelineTab.tsx`
- Test: `frontend/src/notebook/TimelineTab.test.tsx`

**Interfaces:**
- Consumes: `TimelinePayload` from `@weeklog/types`; `Icon` from `../ui/Icon`; `fmtDate` from `../ui/primitives`.
- Produces: `TimelineTab({ payload }: { payload: TimelinePayload })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/notebook/TimelineTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineTab } from "./TimelineTab";
import type { TimelinePayload } from "@weeklog/types";

const payload: TimelinePayload = {
  subsystems: [
    { name: "Shooter", entries: [{ date: "2026-07-07", kind: "accomplishment", text: "Shooter tuned", created_by: "kid@example.com" }] },
    { name: "Climber", entries: [{ date: "2026-07-08", kind: "failure", text: "Hook slipped", created_by: null }] },
  ],
  photosByDate: [{ date: "2026-07-07", photos: [{ caption: "test rig", kind: "photo" }] }],
};

describe("TimelineTab", () => {
  it("shows the first subsystem, switches on pick, and renders photos by date", () => {
    render(<TimelineTab payload={payload} />);
    expect(screen.getByText("Shooter tuned")).toBeTruthy();
    expect(screen.getByText(/test rig/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Climber/ }));
    expect(screen.getByText("Hook slipped")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/TimelineTab.test.tsx`
Expected: FAIL (module `./TimelineTab` not found).

- [ ] **Step 3: Implement the component**

Create `frontend/src/notebook/TimelineTab.tsx`:

```tsx
import { useState } from "react";
import type { TimelinePayload, TimelineEntryKind } from "@weeklog/types";
import { fmtDate } from "../ui/primitives";

// RAG-legible palette by entry kind. Green good, red attention, neutral otherwise.
const KIND_COLOR: Record<TimelineEntryKind, string> = {
  accomplishment: "var(--ok)",
  failure: "var(--bad)",
  build_need: "var(--warn)",
  performance_goal: "var(--maroon-bright)",
  note: "var(--fg-faint)",
};
const KIND_LABEL: Record<TimelineEntryKind, string> = {
  accomplishment: "Accomplishment",
  failure: "Failure",
  build_need: "Build need",
  performance_goal: "Performance goal",
  note: "Note",
};

export function TimelineTab({ payload }: { payload: TimelinePayload }) {
  const subsystems = payload.subsystems;
  const [active, setActive] = useState(subsystems[0]?.name ?? "");
  if (subsystems.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No logged submissions yet.</p>;
  }
  const current = subsystems.find((s) => s.name === active) ?? subsystems[0];
  const photosFor = (date: string) => payload.photosByDate.find((p) => p.date === date)?.photos ?? [];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {subsystems.map((s) => (
          <button
            key={s.name}
            className="btn btn-sm"
            onClick={() => setActive(s.name)}
            style={{ background: s.name === current.name ? "var(--maroon-tint)" : undefined }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {current.entries.map((e, i) => {
          const photos = photosFor(e.date);
          return (
            <div key={i} className="card card-pad">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 50, background: KIND_COLOR[e.kind], flex: "none" }} />
                <span className="mono-label">{KIND_LABEL[e.kind]}</span>
                <span className="mono-label" style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{fmtDate(e.date)}</span>
              </div>
              <div style={{ fontSize: 15 }}>{e.text}</div>
              {e.created_by && <div className="mono-label" style={{ marginTop: 6, color: "var(--fg-faint)" }}>{e.created_by}</div>}
              {photos.length > 0 && (
                <div className="mono-label" style={{ marginTop: 8, color: "var(--fg-dim)" }}>
                  Photos this meeting: {photos.map((p) => p.caption || p.kind).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/TimelineTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/notebook/TimelineTab.tsx frontend/src/notebook/TimelineTab.test.tsx
git commit -m "feat(notebook): Timeline tab component"
```

---

### Task 8: Notebook Prep view + nav wiring

**Files:**
- Create: `frontend/src/notebook/NotebookView.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/notebook/NotebookView.test.tsx`

**Interfaces:**
- Consumes: `useNotebook` (Task 6), `TimelineTab` (Task 7), `useAuth` from `../auth/AuthProvider`, `fmtDate` from `../ui/primitives`.
- Produces: `NotebookView()` default-styled view; new `"notebook"` tab in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/notebook/NotebookView.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ isAdmin: false, email: null }) }));
vi.mock("../lib/hooks/useNotebook", () => ({
  useNotebook: () => ({
    timeline: null,
    pending: [],
    busy: false,
    generateTimeline: vi.fn(),
    requestRefresh: vi.fn(),
  }),
}));

import { NotebookView } from "./NotebookView";

describe("NotebookView", () => {
  it("always shows the not-a-notebook banner and disabled future tabs", () => {
    render(<NotebookView />);
    expect(screen.getByText(/The team writes the notebook/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Gaps" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx`
Expected: FAIL (module `./NotebookView` not found).

- [ ] **Step 3: Implement the view**

Create `frontend/src/notebook/NotebookView.tsx`:

```tsx
import { useState } from "react";
import { useNotebook } from "../lib/hooks/useNotebook";
import { useAuth } from "../auth/AuthProvider";
import { TimelineTab } from "./TimelineTab";
import { fmtDate } from "../ui/primitives";

type NbTab = "timeline" | "gaps" | "decisions" | "scaffold";
const TABS: { id: NbTab; label: string; ready: boolean }[] = [
  { id: "timeline", label: "Timeline", ready: true },
  { id: "gaps", label: "Gaps", ready: false },
  { id: "decisions", label: "Decisions", ready: false },
  { id: "scaffold", label: "Scaffold", ready: false },
];

export function NotebookView() {
  const { isAdmin } = useAuth();
  const { timeline, reports, pending, busy, generateTimeline, requestRefresh } = useNotebook();
  const [tab, setTab] = useState<NbTab>("timeline");
  const timelinePending = pending.find((p) => p.kind === "timeline")?.count ?? 0;
  const generatedAt = reports?.timeline?.generated_at ?? null;

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
            {t.label}{t.ready ? "" : " (soon)"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {isAdmin ? (
          <button className="btn btn-sm" disabled={busy} onClick={generateTimeline}>
            {busy ? "Generating..." : "Generate / refresh timelines"}
          </button>
        ) : (
          <button className="btn btn-sm" onClick={() => requestRefresh("timeline")}>Request refresh</button>
        )}
        {isAdmin && timelinePending > 0 && (
          <span className="mono-label" style={{ color: "var(--warn)" }}>{timelinePending} refresh requested</span>
        )}
        <span className="mono-label" style={{ color: "var(--fg-faint)" }}>
          {generatedAt ? `Last updated ${fmtDate(generatedAt)}` : "Not generated yet"}
        </span>
      </div>

      {tab === "timeline" &&
        (timeline ? (
          <TimelineTab payload={timeline} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>
            No timeline yet. {isAdmin ? "Click Generate to build it." : "Ask an admin to generate it."}
          </p>
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace @weeklog/frontend -- src/notebook/NotebookView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the nav in App.tsx**

In `frontend/src/App.tsx`, make these exact edits:

Add the import near the other view imports:

```tsx
import { NotebookView } from "./notebook/NotebookView";
```

Change the `Tab` type to include `notebook`:

```tsx
type Tab = "dashboard" | "calendar" | "deadlines" | "browse" | "notebook" | "members" | "templates";
```

Append a `notebook` entry to the `MAIN` array (after the `browse` entry, before `members`):

```tsx
  { id: "notebook", label: "Notebook", icon: "list" },
```

Because `MAIN` now has a new item before `members`, update the two index-based lines. Replace:

```tsx
const BAR = MAIN.slice(0, 4);
const MEMBERS_TAB = MAIN[4];
```

with:

```tsx
const BAR = MAIN.slice(0, 4);
const OVERFLOW = MAIN.slice(4); // notebook + members, shown in the mobile More sheet
```

Add a `notebook` title to `TITLE`:

```tsx
  notebook: "Notebook prep",
```

Add the render line in `Content`, after the `browse` line:

```tsx
      {tab === "notebook" && <NotebookView />}
```

Update the mobile More sheet list. Replace:

```tsx
              {[MEMBERS_TAB, ...(isAdmin ? ADMIN : [])].map((t) => (
```

with:

```tsx
              {[...OVERFLOW, ...(isAdmin ? ADMIN : [])].map((t) => (
```

- [ ] **Step 6: Run the App smoke test and the notebook tests**

Run: `npm run test --workspace @weeklog/frontend`
Expected: PASS (App smoke test still renders; notebook tests pass).

- [ ] **Step 7: Full verify (typecheck + tests + build)**

Run: `npm run verify`
Expected: PASS (typecheck all workspaces, worker + frontend tests, frontend build).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/notebook/NotebookView.tsx frontend/src/notebook/NotebookView.test.tsx frontend/src/App.tsx
git commit -m "feat(notebook): Notebook Prep view + nav entry"
```

---

## Deferred (not in this plan; seams left)

- `POST /api/notebook/publish` admin write-back for offline-authored reports (gaps/decisions/scaffold).
- `season.json` export for the offline Claude Code reasoning phases.
- Coverage stats, gap analysis, decision extraction, scaffold assembly, and their tabs/payloads.
- Tagging media with a subsystem at upload time.

## Self-Review notes

- Spec coverage: shared types (Task 1), tables (Task 2), reports/requests/generate routes (Tasks 3-5), Timeline tab + view + nav (Tasks 6-8), guardrails (global constraints + banner in Task 8). Deferred items match the spec's out-of-scope list.
- Type consistency: `useNotebook` returns `timeline: TimelinePayload | null`, consumed by `NotebookView` and passed to `TimelineTab({ payload })`. `PendingRequestSummary.count/kind` used consistently in worker `GET /requests` and the view indicator. Entry kinds are the DB-native set (`performance_goal`, not `goal`) everywhere.
- Deviation from spec: entry kind `performance_goal` retained (spec section 3 wrote `goal`) to avoid a lossy remap and keep entries verbatim. Recorded here intentionally.
