# Phase 1: Foundation & Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo skeleton for the Team Qatar FGC 2026 Meeting Compliance tracker: workspaces, a Hono Worker with a health endpoint, the full D1 schema + seed, a Vite React hello-world, and wrangler config, all compiling and tested.

**Architecture:** npm-workspaces monorepo with three packages: `types` (shared TS types, no runtime), `worker` (Hono on Cloudflare Workers + D1 + R2), `frontend` (React + Vite on Cloudflare Pages). Phase 1 builds only the foundation defined in PRD Section 10.1: scaffold, wrangler config, D1 schema + migration + seed, hello-world Worker + Pages. No business logic yet.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers/Pages/D1/R2, Vite + React, Vitest, better-sqlite3 (test-only, to validate migration/seed SQL against an in-memory SQLite).

**Test strategy note:** Cloudflare config files (`wrangler.toml`) and the Vite scaffold are not meaningfully unit-testable, so those tasks verify by build/typecheck instead of a unit test. The two pieces with real logic worth a test — the Worker health route and the D1 migration+seed — are done test-first.

---

## File Structure

```
/
  package.json                  # root, npm workspaces, shared scripts
  .gitignore
  wrangler.toml                 # Workers + D1 + R2 bindings (Pages connected via dashboard)
  README.md                     # from-scratch free Cloudflare deploy steps
  /types
    package.json
    tsconfig.json
    src/index.ts                # shared domain types (members, requirements, meeting days...)
  /worker
    package.json
    tsconfig.json
    vitest.config.ts
    src/index.ts                # Hono app: GET /api/health
    migrations/0001_init.sql    # full Section 4 schema
    migrations/0002_seed.sql    # Section 5 requirement templates + example deadline
    seed/roster.sql             # roster seed (Team Qatar committees)
    test/health.test.ts         # health route
    test/schema.test.ts         # migration + seed applied to in-memory SQLite
  /frontend
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/main.tsx
    src/App.tsx                 # hello-world landing
```

---

## Task 1: Git init + root workspace

**Files:**
- Create: `.gitignore`
- Create: `package.json` (root)

- [ ] **Step 1: Init git**

Run: `git init`
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
.wrangler/
.dev.vars
*.local
.DS_Store
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "fgc-2026-weeklog",
  "private": true,
  "workspaces": ["types", "worker", "frontend"],
  "scripts": {
    "test": "npm run test --workspace worker",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "build": "npm run build --workspace frontend"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json
git commit -m "chore: init monorepo workspace root"
```

---

## Task 2: Shared `types` package

**Files:**
- Create: `types/package.json`
- Create: `types/tsconfig.json`
- Create: `types/src/index.ts`

- [ ] **Step 1: Write `types/package.json`**

```json
{
  "name": "@weeklog/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Write `types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `types/src/index.ts`** (mirrors PRD Section 4)

```ts
// Shared domain types for the FGC 2026 meeting compliance tracker.
// Mirrors the D1 schema in worker/migrations/0001_init.sql.

export type ExpectedKind = "attendance" | "text" | "media" | "any";

export type SubmissionKind =
  | "attendance"
  | "accomplishment"
  | "build_need"
  | "performance_goal"
  | "failure"
  | "note"
  | "media";

export type RequirementStatus = "missing" | "submitted";
export type DeadlineStatus = "open" | "done";
export type DeadlineCategory = "social_media" | "design" | "strategy" | "other";
export type MediaKind = "photo" | "sketch" | "doc" | "video";

// Derived compliance colors used across calendar/dashboard.
export type Rag = "green" | "amber" | "red";

export interface Member {
  id: string;
  name: string;
  committee: string | null;
  active: number;
}

export interface RequirementTemplate {
  id: string;
  label: string;
  description: string | null;
  compulsory: number;
  expected_kind: ExpectedKind | null;
  active: number;
  sort_order: number | null;
}

export interface MeetingDay {
  id: string;
  date: string;
  title: string | null;
  note: string | null;
  created_by: string | null;
}

export interface MeetingRequirement {
  id: string;
  meeting_day_id: string;
  template_id: string | null;
  label: string;
  compulsory: number;
  expected_kind: ExpectedKind | null;
  status: RequirementStatus;
}

export interface Submission {
  id: string;
  meeting_day_id: string;
  requirement_id: string | null;
  kind: SubmissionKind;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface Attendance {
  id: string;
  meeting_day_id: string;
  member_id: string;
  present: number;
}

export interface Media {
  id: string;
  meeting_day_id: string | null;
  deadline_id: string | null;
  requirement_id: string | null;
  subsystem: string | null;
  r2_key: string;
  caption: string | null;
  kind: MediaKind | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  category: DeadlineCategory | null;
  due_date: string;
  status: DeadlineStatus;
  completed_at: string | null;
  link: string | null;
}
```

- [ ] **Step 4: Install + typecheck**

Run: `npm install` then `npm run typecheck --workspace @weeklog/types`
Expected: exits 0, no type errors.

- [ ] **Step 5: Commit**

```bash
git add types package-lock.json package.json
git commit -m "feat(types): add shared domain types mirroring D1 schema"
```

---

## Task 3: Worker package + health endpoint (TDD)

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/vitest.config.ts`
- Create: `worker/src/index.ts`
- Test: `worker/test/health.test.ts`

- [ ] **Step 1: Write `worker/package.json`**

```json
{
  "name": "@weeklog/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240909.0",
    "better-sqlite3": "^11.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Write `worker/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing test** `worker/test/health.test.ts`

```ts
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("GET /api/health", () => {
  it("returns ok with a service name", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "weeklog-worker" });
  });
});
```

- [ ] **Step 5: Run test, verify it fails**

Run: `npm run test --workspace @weeklog/worker`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 6: Write minimal `worker/src/index.ts`**

```ts
import { Hono } from "hono";

// Cloudflare bindings (D1 + R2) declared now so later phases attach to the same Env.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  TEAM_PASSWORD_HASH: string;
  ADMIN_PASSWORD_HASH: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "weeklog-worker" }));

export default app;
```

- [ ] **Step 7: Run test, verify it passes**

Run: `npm run test --workspace @weeklog/worker`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add worker package.json package-lock.json
git commit -m "feat(worker): Hono app with /api/health endpoint"
```

---

## Task 4: D1 migration — full Section 4 schema

**Files:**
- Create: `worker/migrations/0001_init.sql`

This task has no standalone test; Task 5 tests this SQL together with the seed. Build it first so Task 5 can apply it.

- [ ] **Step 1: Write `worker/migrations/0001_init.sql`** (SQLite, matches PRD Section 4 exactly)

```sql
-- Phase 1 schema for the FGC 2026 meeting compliance tracker (PRD Section 4).
-- ISO-8601 text dates, UUID text ids.

CREATE TABLE members (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  committee TEXT,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE requirement_templates (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  compulsory    INTEGER NOT NULL DEFAULT 1,
  expected_kind TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER
);

CREATE TABLE meeting_days (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL UNIQUE,
  title      TEXT,
  note       TEXT,
  created_by TEXT
);

CREATE TABLE meeting_requirements (
  id             TEXT PRIMARY KEY,
  meeting_day_id TEXT NOT NULL REFERENCES meeting_days(id),
  template_id    TEXT REFERENCES requirement_templates(id),
  label          TEXT NOT NULL,
  compulsory     INTEGER NOT NULL,
  expected_kind  TEXT,
  status         TEXT NOT NULL DEFAULT 'missing'
);

CREATE TABLE submissions (
  id             TEXT PRIMARY KEY,
  meeting_day_id TEXT NOT NULL REFERENCES meeting_days(id),
  requirement_id TEXT REFERENCES meeting_requirements(id),
  kind           TEXT NOT NULL,
  subsystem      TEXT,
  content        TEXT,
  created_by     TEXT,
  created_at     TEXT
);

CREATE TABLE attendance (
  id             TEXT PRIMARY KEY,
  meeting_day_id TEXT NOT NULL REFERENCES meeting_days(id),
  member_id      TEXT NOT NULL REFERENCES members(id),
  present        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE media (
  id             TEXT PRIMARY KEY,
  meeting_day_id TEXT REFERENCES meeting_days(id),
  deadline_id    TEXT REFERENCES deadlines(id),
  requirement_id TEXT REFERENCES meeting_requirements(id),
  subsystem      TEXT,
  r2_key         TEXT NOT NULL,
  caption        TEXT,
  kind           TEXT,
  uploaded_at    TEXT,
  uploaded_by    TEXT
);

CREATE TABLE deadlines (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  due_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  completed_at TEXT,
  link         TEXT
);

CREATE INDEX idx_meeting_requirements_day ON meeting_requirements(meeting_day_id);
CREATE INDEX idx_submissions_day ON submissions(meeting_day_id);
CREATE INDEX idx_attendance_day ON attendance(meeting_day_id);
CREATE INDEX idx_media_day ON media(meeting_day_id);
CREATE INDEX idx_deadlines_due ON deadlines(due_date);
```

Note: `media.deadline_id` forward-references `deadlines`. SQLite resolves FK references at write time, not table-create time, so declaration order is fine. The test in Task 5 applies this whole file at once and will confirm.

- [ ] **Step 2: Commit**

```bash
git add worker/migrations/0001_init.sql
git commit -m "feat(worker): D1 init migration with full schema"
```

---

## Task 5: D1 seed + migration test (TDD)

**Files:**
- Create: `worker/migrations/0002_seed.sql`
- Test: `worker/test/schema.test.ts`

The seed is the page-42 compulsory list + 3 optional items + one example deadline (PRD Section 5 and 6.5). We write the test first, asserting exactly those rows, then write the seed to satisfy it.

- [ ] **Step 1: Write the failing test** `worker/test/schema.test.ts`

```ts
import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function sql(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

describe("D1 migration + seed", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(sql("../migrations/0001_init.sql"));
    db.exec(sql("../migrations/0002_seed.sql"));
  });

  it("creates every Section 4 table", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    for (const t of [
      "members",
      "requirement_templates",
      "meeting_days",
      "meeting_requirements",
      "submissions",
      "attendance",
      "media",
      "deadlines",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("seeds the six page-42 compulsory templates", () => {
    const rows = db
      .prepare(
        "SELECT label FROM requirement_templates WHERE compulsory=1 ORDER BY sort_order"
      )
      .all()
      .map((r: any) => r.label);
    expect(rows).toEqual([
      "Attendance records",
      "Robot accomplishments",
      "Build needs",
      "Performance goals",
      "Photos from the meeting",
      "Photos of all plans/designs/sketches",
    ]);
  });

  it("seeds three optional templates", () => {
    const n = db
      .prepare("SELECT COUNT(*) AS n FROM requirement_templates WHERE compulsory=0")
      .get() as any;
    expect(n.n).toBe(3);
  });

  it("seeds the example social media deadline", () => {
    const row = db
      .prepare("SELECT category FROM deadlines WHERE title LIKE 'SM Challenge #1%'")
      .get() as any;
    expect(row.category).toBe("social_media");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test --workspace @weeklog/worker`
Expected: FAIL — `0002_seed.sql` not found / no seeded rows.

- [ ] **Step 3: Write `worker/migrations/0002_seed.sql`**

```sql
-- Seed requirement templates from the team's rules (PRD Section 5).
-- Compulsory items = page 42 "at the end of every meeting".
INSERT INTO requirement_templates (id, label, description, compulsory, expected_kind, active, sort_order) VALUES
  ('tpl-attendance',     'Attendance records',                   'Who was present at the meeting.',                1, 'attendance', 1, 1),
  ('tpl-accomplishments','Robot accomplishments',                'What the robot or team achieved this meeting.',   1, 'text',       1, 2),
  ('tpl-build-needs',    'Build needs',                          'Parts, materials, or work still required.',        1, 'text',       1, 3),
  ('tpl-perf-goals',     'Performance goals',                    'Targets for the next session.',                    1, 'text',       1, 4),
  ('tpl-photos-meeting', 'Photos from the meeting',              'General photos documenting the session.',          1, 'media',      1, 5),
  ('tpl-photos-sketches','Photos of all plans/designs/sketches', 'Photos of every plan, design, and sketch.',        1, 'media',      1, 6),
  ('tpl-failure-log',    'Failure / iteration log',              'What did not work and the retry plan. Judges value honest iteration.', 0, 'text',  1, 7),
  ('tpl-cad-file',       'CAD / design file',                    'Exported CAD or design file.',                     0, 'media',      1, 8),
  ('tpl-strategy-note',  'Strategy note',                        'Strategic observation or decision.',               0, 'text',       1, 9);

-- One example standalone deadline so the tracker is obviously populated (PRD Section 6.5).
INSERT INTO deadlines (id, title, description, category, due_date, status, completed_at, link) VALUES
  ('dl-sm-1', 'SM Challenge #1: STEMConnect', 'First social media challenge. Scores competition points.', 'social_media', '2026-07-01', 'open', NULL, NULL);
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test --workspace @weeklog/worker`
Expected: PASS (health + 4 schema tests).

- [ ] **Step 5: Commit**

```bash
git add worker/migrations/0002_seed.sql worker/test/schema.test.ts
git commit -m "feat(worker): seed requirement templates + example deadline, with migration test"
```

---

## Task 6: Roster seed script

**Files:**
- Create: `worker/seed/roster.sql`

Roster from PRD intro: ~21 members across committees (Outreach, Design, Notebook, Strategy, Build [Drivetrain/Collector, Shooter, Climber, Practice Arena], Programming). Names are placeholders the admin edits later; committees are the real seed value.

- [ ] **Step 1: Write `worker/seed/roster.sql`**

```sql
-- Roster seed for Team Qatar (PRD Section 0). Names are placeholders; committees are real.
-- Run after migrations. Admin edits names via the roster manager in a later phase.
INSERT INTO members (id, name, committee, active) VALUES
  ('m-01', 'Member 01', 'Outreach',        1),
  ('m-02', 'Member 02', 'Outreach',        1),
  ('m-03', 'Member 03', 'Design',          1),
  ('m-04', 'Member 04', 'Design',          1),
  ('m-05', 'Member 05', 'Notebook',        1),
  ('m-06', 'Member 06', 'Notebook',        1),
  ('m-07', 'Member 07', 'Strategy',        1),
  ('m-08', 'Member 08', 'Strategy',        1),
  ('m-09', 'Member 09', 'Drivetrain/Collector', 1),
  ('m-10', 'Member 10', 'Drivetrain/Collector', 1),
  ('m-11', 'Member 11', 'Drivetrain/Collector', 1),
  ('m-12', 'Member 12', 'Shooter',         1),
  ('m-13', 'Member 13', 'Shooter',         1),
  ('m-14', 'Member 14', 'Shooter',         1),
  ('m-15', 'Member 15', 'Climber',         1),
  ('m-16', 'Member 16', 'Climber',         1),
  ('m-17', 'Member 17', 'Practice Arena',  1),
  ('m-18', 'Member 18', 'Practice Arena',  1),
  ('m-19', 'Member 19', 'Programming',     1),
  ('m-20', 'Member 20', 'Programming',     1),
  ('m-21', 'Member 21', 'Programming',     1);
```

- [ ] **Step 2: Verify it applies cleanly (manual, against in-memory SQLite)**

Run: `node -e "const D=require('better-sqlite3');const fs=require('fs');const db=new D(':memory:');db.exec(fs.readFileSync('worker/migrations/0001_init.sql','utf8'));db.exec(fs.readFileSync('worker/seed/roster.sql','utf8'));console.log(db.prepare('SELECT COUNT(*) n FROM members').get())"`
Expected: `{ n: 21 }`

- [ ] **Step 3: Commit**

```bash
git add worker/seed/roster.sql
git commit -m "feat(worker): roster seed (21 members across committees)"
```

---

## Task 7: Frontend — Vite React hello-world

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "@weeklog/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
```

- [ ] **Step 4: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Team Qatar FGC 2026 Log</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Write `frontend/src/App.tsx`** (note: no em dashes in UI copy, PRD constraint)

```tsx
import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? "online" : "degraded"))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Team Qatar FGC 2026</h1>
      <p>Meeting Compliance and Documentation Tracker</p>
      <p>Worker status: {health}</p>
    </main>
  );
}
```

- [ ] **Step 7: Install + build**

Run: `npm install` then `npm run build --workspace @weeklog/frontend`
Expected: Vite build succeeds, emits `frontend/dist`.

- [ ] **Step 8: Commit**

```bash
git add frontend package.json package-lock.json
git commit -m "feat(frontend): Vite React hello-world with health probe"
```

---

## Task 8: wrangler.toml (Workers + D1 + R2 bindings)

**Files:**
- Create: `wrangler.toml`

Not unit-tested; verified by `wrangler deploy --dry-run`. Placeholder ids are replaced during real deploy per the README.

- [ ] **Step 1: Write `wrangler.toml`**

```toml
name = "weeklog-worker"
main = "worker/src/index.ts"
compatibility_date = "2024-09-23"

# D1 database. Create with: wrangler d1 create weeklog
# then paste the returned database_id below.
[[d1_databases]]
binding = "DB"
database_name = "weeklog"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
migrations_dir = "worker/migrations"

# R2 bucket for media uploads. Create with: wrangler r2 bucket create weeklog-media
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "weeklog-media"

# Secrets (set with `wrangler secret put`):
#   TEAM_PASSWORD_HASH, ADMIN_PASSWORD_HASH
```

- [ ] **Step 2: Verify config parses**

Run: `npx wrangler deploy --dry-run --outdir .wrangler/dry 2>&1`
Expected: Dry run completes, bundles `worker/src/index.ts`, reports the D1 + R2 bindings. (A warning about the placeholder `database_id` is acceptable for a dry run; an actual parse error is not.)

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml
git commit -m "chore: wrangler config with D1 + R2 bindings"
```

---

## Task 9: README — free Cloudflare deploy steps

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** (PRD Section 9; assume only a Cloudflare account + Node)

```markdown
# Team Qatar FGC 2026 — Meeting Compliance & Documentation Tracker

A calendar-driven compliance tracker. The admin marks meeting days; each meeting day
carries a checklist of required submissions; the system flags missed days, missing
compulsory items, and overdue deadlines on a red/amber/green dashboard.

Runs entirely on the Cloudflare free tier ($0): Pages (frontend), Workers (API),
D1 (database), R2 (media).

## Prerequisites

- A free Cloudflare account
- Node.js 20+ and npm

## Local development

```bash
npm install
# Terminal 1: API
npx wrangler dev
# Terminal 2: frontend (proxies /api to the worker)
npm run dev --workspace @weeklog/frontend
```

## First-time Cloudflare setup

```bash
npx wrangler login

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create weeklog

# 2. Create the R2 bucket
npx wrangler r2 bucket create weeklog-media

# 3. Apply migrations + seeds to the remote DB
npx wrangler d1 migrations apply weeklog --remote
npx wrangler d1 execute weeklog --remote --file worker/seed/roster.sql

# 4. Set auth secrets (store only hashes; see auth phase for hashing)
npx wrangler secret put TEAM_PASSWORD_HASH
npx wrangler secret put ADMIN_PASSWORD_HASH

# 5. Deploy the worker
npx wrangler deploy
```

## Frontend (Cloudflare Pages)

Build command: `npm run build --workspace @weeklog/frontend`
Output directory: `frontend/dist`
Connect the repo in the Cloudflare Pages dashboard and set those values, or run
`npx wrangler pages deploy frontend/dist`.

## Free-tier sanity

- D1: 5 GB storage, 5M rows read/day free.
- R2: 10 GB storage, no egress fees.
- Workers: 100k requests/day free.
- Pages: unlimited static requests free.

All well within a 21-member team's usage.

## Project structure

- `types/` shared TypeScript domain types
- `worker/` Hono API, D1 migrations + seeds
- `frontend/` React + Vite app
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with free Cloudflare deploy steps"
```

---

## Task 10: Phase 1 verification gate

PRD Section 10 requires confirming each phase compiles before moving on.

- [ ] **Step 1: Typecheck all workspaces**

Run: `npm run typecheck`
Expected: all three packages exit 0.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: PASS — health test + 4 schema/seed tests.

- [ ] **Step 3: Build frontend**

Run: `npm run build`
Expected: Vite emits `frontend/dist`.

- [ ] **Step 4: Worker dry-run deploy**

Run: `npx wrangler deploy --dry-run --outdir .wrangler/dry`
Expected: bundles successfully.

- [ ] **Step 5: Final commit (tag the phase)**

```bash
git add -A
git commit -m "chore: phase 1 foundation complete" --allow-empty
```

---

## Self-Review

**Spec coverage (PRD Section 10.1 = scope of this plan):**
- Scaffold monorepo → Tasks 1, 2, 3, 7
- wrangler config (Pages + Workers + D1 + R2) → Task 8 (Pages connected via dashboard per README; Workers/D1/R2 in wrangler.toml)
- D1 schema → Task 4 (all 8 Section 4 tables)
- migration + seed → Tasks 4, 5 (Section 5 templates + example deadline)
- roster seed → Task 6
- hello-world Worker + Pages → Tasks 3, 7
- README deploy steps → Task 9

Out of scope for Phase 1 (later phases, correctly absent): auth, calendar, meeting detail, compliance engine, dashboard, search, ZIP/Drive stub.

**Placeholder scan:** `database_id = "REPLACE_WITH_D1_DATABASE_ID"` is an intentional deploy-time value documented in the README, not a plan placeholder. No "TBD"/"handle edge cases"/"write tests for the above" without code.

**Type consistency:** `Env { DB, MEDIA, TEAM_PASSWORD_HASH, ADMIN_PASSWORD_HASH }` in Task 3 matches the `wrangler.toml` bindings (`DB`, `MEDIA`) and secrets in Task 8. Shared types in Task 2 mirror the column names/types in the Task 4 migration (e.g. `expected_kind`, `compulsory`, `sort_order`). Seed labels in Task 5 match the test's expected array exactly.
```
