-- A simple resolved flag so build needs can be aggregated into an open list
-- and ticked off when handled (PRD 6.6 "Open Build Needs").
ALTER TABLE submissions ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
