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
