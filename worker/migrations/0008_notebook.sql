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
