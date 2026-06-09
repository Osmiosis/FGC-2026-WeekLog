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
