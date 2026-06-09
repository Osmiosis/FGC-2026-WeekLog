-- Per-meeting requirement editing. `active=0` soft-removes a requirement from a
-- meeting's checklist (keeping any linked media/submissions). `custom=1` marks a
-- one-off requirement that is not backed by a template.
ALTER TABLE meeting_requirements ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meeting_requirements ADD COLUMN custom INTEGER NOT NULL DEFAULT 0;
