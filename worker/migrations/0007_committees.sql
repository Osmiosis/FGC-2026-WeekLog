-- Normalize committees into their own dimension table plus a member<->committee
-- join, so a single member can belong to more than one committee.
-- The legacy members.committee column is left in place (no longer read/written).

CREATE TABLE committees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER
);

CREATE TABLE member_committees (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  committee_id TEXT NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, committee_id)
);

CREATE INDEX idx_member_committees_committee ON member_committees(committee_id);

-- Backfill the committee dimension from whatever committees the roster already
-- uses (covers an existing, already-seeded database such as production).
INSERT OR IGNORE INTO committees (id, name)
  SELECT 'com-' || lower(replace(replace(committee, '/', '-'), ' ', '-')), committee
  FROM (SELECT DISTINCT committee FROM members WHERE committee IS NOT NULL AND committee <> '');

-- Carry each member's current single committee into the join table.
INSERT OR IGNORE INTO member_committees (member_id, committee_id)
  SELECT m.id, 'com-' || lower(replace(replace(m.committee, '/', '-'), ' ', '-'))
  FROM members m
  WHERE m.committee IS NOT NULL AND m.committee <> '';
