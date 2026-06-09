-- Track each media object's byte size so the worker can enforce a total
-- storage ceiling and never let the R2 bucket cross the free-tier limit.
ALTER TABLE media ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;
