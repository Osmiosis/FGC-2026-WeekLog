# PRD: Team Qatar FGC 2026 — Meeting Compliance & Documentation Tracker

## 0. Read this first (context for the implementing agent)

You are building a web application for a **FIRST Global Challenge (FGC) 2026** national robotics
team ("Team Qatar"). ~21 members across committees (Outreach, Design, Notebook, Strategy, Build
[Drivetrain/Collector, Shooter, Climber, Practice Arena], Programming). They meet in person during a
build season. Their rules require documenting every meeting and hitting periodic external deadlines
(e.g. social media challenges that directly score competition points).

**This is NOT a Google Drive wrapper and NOT a file dump.** Its spine is a CALENDAR that creates
OBLIGATIONS. The admin marks which days are meeting days. Each meeting day then carries a checklist
of required (and optional) submissions. The system continuously evaluates compliance: a missed
meeting day is flagged; a meeting day missing a compulsory item is flagged; an upcoming or overdue
standalone deadline is flagged. The headline output is a **red/amber/green dashboard** showing the
team's documentation health at a glance. That accountability-against-a-schedule is the thing a Drive
folder fundamentally cannot do.

**Hard constraints:**
- 100% free to run. Target stack: all-Cloudflare free tier.
- Dead simple for non-technical teenage users, usable on a phone.
- The team does NOT control the mentors' Google Drive. Any Drive write is an OPTIONAL, STUBBED
  connector (Section 8). Do not block any core feature on Drive.
- No em dashes anywhere in UI copy or generated text. Use commas, parentheses, or periods.

## 1. Goals & non-goals

### Goals (v1)
1. A calendar where the admin marks meeting days (and can bulk-mark, e.g. "every Tue + Thu").
2. Each meeting day auto-generates a requirements checklist from an editable template.
3. Members submit materials/info against a meeting day (uploads + structured fields).
4. Track standalone deadlines (e.g. social media challenges) independent of meeting days.
5. A red/amber/green compliance dashboard: per day, per week, per requirement, team-wide.
6. Flag: missed meeting days, meeting days missing compulsory items, overdue/upcoming deadlines.
7. Collect ALL useful documentation the team's rules call for (Section 5), searchable.

### Non-goals (v1)
- NO engineering-notebook document generation (explicitly removed from scope).
- No live automatic write into the mentors' Google Drive (stub only; Section 8).
- No per-user SSO. Shared team password + admin password (Section 7).
- No real-time collaboration. Last-write-wins.
- No native mobile apps. Responsive web only.

## 2. Tech stack (REQUIRED — do not substitute)

- **Frontend:** React (Vite) on **Cloudflare Pages**.
- **Backend:** **Cloudflare Workers** + **Hono** (TypeScript).
- **Database:** **Cloudflare D1** (SQLite). Schema in Section 4.
- **File storage:** **Cloudflare R2** for uploads. Signed URLs for reads.
- No paid services, no external DB, no always-on Python server. Deploy via `wrangler`, stay within
  free-tier limits.

## 3. User roles
- **Member:** view calendar/dashboard, submit materials against a meeting day, mark own attendance,
  upload media, view/search, see flags.
- **Admin (you):** all member actions, plus mark/unmark meeting days, edit requirement templates,
  create/edit standalone deadlines, manage roster, delete/override.

v1 auth = one shared team password (member), one admin password. Store only hashes in a Worker
secret / D1. No OAuth.

## 4. Data model (Cloudflare D1 / SQLite)

ISO-8601 text for dates; UUIDs for ids.

```
members
  id TEXT PK
  name TEXT NOT NULL
  committee TEXT
  active INTEGER DEFAULT 1

-- Editable definition of what a meeting day requires.
-- Pre-seed with the page-42 compulsory list (see Section 5).
requirement_templates
  id TEXT PK
  label TEXT NOT NULL              -- e.g. "Attendance records", "Photos of sketches"
  description TEXT
  compulsory INTEGER NOT NULL DEFAULT 1   -- 1 = compulsory, 0 = optional
  expected_kind TEXT               -- 'attendance' | 'text' | 'media' | 'any'
  active INTEGER DEFAULT 1
  sort_order INTEGER

-- A day the admin has designated as a meeting.
meeting_days
  id TEXT PK
  date TEXT NOT NULL UNIQUE
  title TEXT
  note TEXT
  created_by TEXT

-- A concrete required item for a specific meeting day, snapshotted from a template
-- at the time the meeting day is created (so later template edits don't rewrite history).
meeting_requirements
  id TEXT PK
  meeting_day_id TEXT NOT NULL FK -> meeting_days.id
  template_id TEXT FK -> requirement_templates.id (nullable if ad-hoc)
  label TEXT NOT NULL
  compulsory INTEGER NOT NULL
  expected_kind TEXT
  status TEXT NOT NULL DEFAULT 'missing'   -- 'missing' | 'submitted'
  -- status is DERIVED (see 6.1) but cached here for fast dashboard reads

-- Structured info submitted for a meeting day (accomplishments, build needs, goals, etc.)
submissions
  id TEXT PK
  meeting_day_id TEXT NOT NULL FK -> meeting_days.id
  requirement_id TEXT FK -> meeting_requirements.id (nullable for extra info)
  kind TEXT NOT NULL               -- 'attendance' | 'accomplishment' | 'build_need'
                                    -- | 'performance_goal' | 'failure' | 'note' | 'media'
  subsystem TEXT                   -- Drivetrain, Shooter, Climber, Programming, Strategy...
  content TEXT                     -- the text payload (for non-media kinds)
  created_by TEXT
  created_at TEXT

attendance
  id TEXT PK
  meeting_day_id TEXT NOT NULL FK -> meeting_days.id
  member_id TEXT NOT NULL FK -> members.id
  present INTEGER NOT NULL DEFAULT 1

media
  id TEXT PK
  meeting_day_id TEXT FK -> meeting_days.id (nullable if tied to a deadline)
  deadline_id TEXT FK -> deadlines.id (nullable)
  requirement_id TEXT FK -> meeting_requirements.id (nullable)
  subsystem TEXT
  r2_key TEXT NOT NULL
  caption TEXT
  kind TEXT                        -- 'photo' | 'sketch' | 'doc' | 'video'
  uploaded_at TEXT
  uploaded_by TEXT

-- Standalone, schedule-independent obligations (e.g. social media challenges).
deadlines
  id TEXT PK
  title TEXT NOT NULL              -- e.g. "SM Challenge #1: STEMConnect"
  description TEXT
  category TEXT                    -- 'social_media' | 'design' | 'strategy' | 'other'
  due_date TEXT NOT NULL
  status TEXT NOT NULL DEFAULT 'open'   -- 'open' | 'done'
  completed_at TEXT
  link TEXT                        -- optional reference URL
```

## 5. Requirement template seed (from the team's rules)

Pre-seed `requirement_templates`. COMPULSORY items come from page 42 of the team's intro deck
("at the end of every meeting"):
- Attendance records (compulsory, kind=attendance)
- Robot accomplishments (compulsory, kind=text)
- Build needs (compulsory, kind=text)
- Performance goals (compulsory, kind=text)
- Photos from the meeting (compulsory, kind=media)
- Photos of all plans/designs/sketches (compulsory, kind=media)

OPTIONAL items (pre-seed as compulsory=0, since they are periodic/conditional, not every-meeting):
- Failure / iteration log ("what didn't work + retry plan") (optional, kind=text)
  NOTE: encourage this strongly in the UI; judges value honest iteration. It is optional only
  because not every meeting produces a failure worth logging.
- CAD / design file (optional, kind=media)
- Strategy note (optional, kind=text)

All of these must remain ADMIN-EDITABLE (add, edit, toggle compulsory, deactivate, reorder).

## 6. Core behaviour

### 6.1 Compliance evaluation (the heart of the app)
A meeting day's status is derived:
- For each compulsory `meeting_requirement`: it is 'submitted' if at least one matching submission
  or media exists for that requirement (match by requirement_id, or by kind when requirement_id is
  null). Attendance requirement is satisfied if any attendance rows exist for that day.
- Day status:
  - GREEN: all compulsory requirements submitted.
  - AMBER: some but not all compulsory requirements submitted (in progress), OR day is in the
    future / today and not yet complete.
  - RED: a PAST meeting day with one or more compulsory requirements still missing, OR a meeting
    day that was marked but has NO submissions at all (a "missed" day).
- Optional items never cause RED/AMBER on their own; show them as informational ticks.

Deadlines:
- GREEN: status 'done'.
- AMBER: open and due within 7 days.
- RED: open and past due_date.

### 6.2 Calendar
- Month view. Meeting days visibly marked and color-coded by status.
- Admin can click a day to mark/unmark it as a meeting day, and bulk-mark a recurring pattern
  (e.g. "every Tuesday and Thursday from X to Y"). When a day is marked, snapshot the active
  compulsory + optional templates into `meeting_requirements`.
- Clicking a meeting day opens its detail view (6.3).

### 6.3 Meeting day detail
- Shows the requirement checklist with live submitted/missing state and color.
- Inline controls to satisfy each requirement: attendance checklist (full roster, tap present),
  add accomplishment/build-need/goal/failure rows, upload media (to R2) with {subsystem, caption,
  kind}.
- A "what's still missing" banner listing unmet compulsory items.

### 6.4 Dashboard (landing screen after login)
- Top: overall team status (a single big R/A/G) + counts ("2 days flagged, 1 deadline overdue").
- "Needs attention" list: every RED item (missed days, missing compulsory items, overdue
  deadlines), each linking to where it's fixed.
- "This week" strip: the current week's meeting days with their status.
- Upcoming deadlines with countdown and status.

### 6.5 Deadlines tracker
- List + create/edit (admin) standalone deadlines. Members can mark done + attach the proof media.
- Pre-seed one example so it's obvious: "SM Challenge #1: STEMConnect" (category social_media).

### 6.6 Browse / search
- Search across submissions (accomplishments, build needs, goals, failures, notes).
- Filter by subsystem, date range, kind, compliance status.
- A dedicated "Open Build Needs" view aggregating all build_need submissions not yet marked
  resolved (keep a simple resolved flag on the submission via a status field or a companion table;
  implementer's choice, keep it simple).

## 7. Auth (minimal)
Landing screen: team password unlocks member access; admin password unlocks admin actions. Hashes
only. No third-party auth.

## 8. Google Drive connector (STUBBED in v1)
- Define a TS interface `DriveConnector { isConfigured(): boolean; pushDayMedia(dayId): Promise<...> }`.
- Ship a `NullDriveConnector` (default): isConfigured() = false, push is a no-op.
- Where a Drive push would appear, instead offer "Download day as ZIP" (media + a JSON/Markdown
  summary of that day) and "Download all media" bulk ZIP, so users can drop content into the
  mentors' Drive manually.
- Leave a documented config flag + TODO so a future `R2ToDriveConnector` (service account writing to
  ONE mentor-shared folder) drops in without UI/core changes. Do NOT implement live writes in v1.

## 9. Deliverables & structure
- Monorepo: `/frontend` (React+Vite), `/worker` (Hono+TS), shared `/types`.
- `wrangler.toml` with Pages + Workers + D1 + R2 bindings.
- D1 migration SQL matching Section 4, plus the Section 5 seed.
- Roster seed script.
- `README.md`: exact from-scratch free Cloudflare deploy steps (create D1, create R2, set secrets,
  migrate, `wrangler deploy`, connect Pages). Assume only a Cloudflare account + Node installed.

## 10. Build order (phase-gated; confirm each compiles before moving on)
1. Scaffold monorepo, wrangler config, D1 schema + migration + seed, deploy hello-world Worker+Pages.
2. Auth + members CRUD + requirement_templates CRUD (admin).
3. Calendar: mark/unmark meeting days, bulk recurring mark, snapshot requirements.
4. Meeting day detail: attendance, submissions, media upload to R2.
5. Compliance evaluation engine (6.1) + status caching.
6. Dashboard (R/A/G) + deadlines tracker.
7. Browse/search + Open Build Needs.
8. ZIP download + stubbed DriveConnector seam.
9. README + seeds + free-tier sanity check.

## 11. Acceptance criteria
- Runs entirely on Cloudflare free tier, one URL, $0.
- Admin can mark a recurring meeting schedule in under a minute.
- A past meeting day missing any compulsory item shows RED on the dashboard automatically.
- A meeting day with everything submitted shows GREEN automatically.
- An overdue standalone deadline shows RED; one due within 7 days shows AMBER.
- Requirement templates are fully editable and changes do not rewrite already-snapshotted past days.
- A non-technical member can submit a day's materials on a phone in under 3 minutes.
- No em dashes anywhere.
- Real Drive sync can be enabled later by adding a connector + config only, no rewrite.
