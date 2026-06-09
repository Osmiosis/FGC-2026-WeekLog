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
