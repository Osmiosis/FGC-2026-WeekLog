// frontend/src/lib/demo/seed.ts
// Builds a fresh, evergreen sample dataset. Dates are relative to today so the
// RAG / health views always show a realistic spread regardless of when viewed.
import type { DemoDB, TemplateRow } from "./types";
import { addDaysUTC, todayUTC } from "./compute";

const uuid = () => crypto.randomUUID();

const SUBSYSTEMS = ["Drivetrain/Collector", "Shooter", "Programming", "Strategy"];

export function buildSeed(): DemoDB {
  const today = todayUTC();

  const committees = [
    { id: "c-build", name: "Build", sort_order: 1 },
    { id: "c-prog", name: "Programming", sort_order: 2 },
    { id: "c-strat", name: "Strategy", sort_order: 3 },
    { id: "c-media", name: "Media", sort_order: 4 },
    { id: "c-drive", name: "Drive Team", sort_order: 5 },
  ];

  const members = [
    { id: "m1", name: "Ava Chen", active: 1 },
    { id: "m2", name: "Ben Okafor", active: 1 },
    { id: "m3", name: "Carla Diaz", active: 1 },
    { id: "m4", name: "Dev Patel", active: 1 },
    { id: "m5", name: "Ella Novak", active: 1 },
    { id: "m6", name: "Finn Murphy", active: 1 },
    { id: "m7", name: "Gita Rao", active: 1 },
    { id: "m8", name: "Hiro Tanaka", active: 1 },
  ];

  const member_committees = [
    { member_id: "m1", committee_id: "c-build" },
    { member_id: "m1", committee_id: "c-drive" },
    { member_id: "m2", committee_id: "c-prog" },
    { member_id: "m3", committee_id: "c-strat" },
    { member_id: "m4", committee_id: "c-prog" },
    { member_id: "m4", committee_id: "c-build" },
    { member_id: "m5", committee_id: "c-media" },
    { member_id: "m6", committee_id: "c-build" },
    { member_id: "m7", committee_id: "c-strat" },
    { member_id: "m7", committee_id: "c-drive" },
    { member_id: "m8", committee_id: "c-prog" },
  ];

  const templates: TemplateRow[] = [
    { id: "t-att", label: "Attendance", description: "Who showed up", compulsory: 1, expected_kind: "attendance", active: 1, sort_order: 1 },
    { id: "t-acc", label: "Daily accomplishments", description: null, compulsory: 1, expected_kind: "text", active: 1, sort_order: 2 },
    { id: "t-perf", label: "Performance goals", description: null, compulsory: 1, expected_kind: "text", active: 1, sort_order: 3 },
    { id: "t-build", label: "Build needs", description: null, compulsory: 0, expected_kind: "text", active: 1, sort_order: 4 },
    { id: "t-photo", label: "Photos & media", description: null, compulsory: 0, expected_kind: "media", active: 1, sort_order: 5 },
  ];

  const db: DemoDB = {
    committees, members, member_committees, templates,
    meeting_days: [], meeting_requirements: [], attendance: [], submissions: [], media: [], deadlines: [],
  };

  // Snapshot the active templates onto a new meeting day (mirrors worker snapshot).
  const snapshot = (dayId: string) => {
    for (const t of templates.filter((x) => x.active === 1).sort((a, b) => a.sort_order - b.sort_order)) {
      db.meeting_requirements.push({
        id: uuid(), meeting_day_id: dayId, template_id: t.id, label: t.label,
        compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0,
      });
    }
  };

  // Satisfy every compulsory requirement on a day so it derives green.
  const satisfyDay = (dayId: string) => {
    const reqs = db.meeting_requirements.filter((r) => r.meeting_day_id === dayId && r.active === 1);
    db.attendance.push(
      { id: uuid(), meeting_day_id: dayId, member_id: "m1", present: 1 },
      { id: uuid(), meeting_day_id: dayId, member_id: "m2", present: 1 },
      { id: uuid(), meeting_day_id: dayId, member_id: "m4", present: 1 },
    );
    for (const r of reqs) {
      if (r.expected_kind === "text") {
        db.submissions.push({
          id: uuid(), meeting_day_id: dayId, requirement_id: r.id, kind: "accomplishment",
          subsystem: SUBSYSTEMS[0], content: `Logged: ${r.label.toLowerCase()}.`,
          created_by: "ava@demo.app", created_at: `${db.meeting_days.find((d) => d.id === dayId)!.date}T18:00:00Z`, resolved: 0,
        });
      } else if (r.expected_kind === "media") {
        db.media.push({
          id: uuid(), meeting_day_id: dayId, deadline_id: null, requirement_id: r.id, subsystem: null,
          caption: "Build progress", kind: "photo", content_type: "image/svg+xml",
          uploaded_by: "ella@demo.app", uploaded_at: `${db.meeting_days.find((d) => d.id === dayId)!.date}T18:05:00Z`,
        });
      }
    }
  };

  // Six days spanning past→future to spread RAG: green / red / green / red / amber / amber.
  const plan: Array<{ date: string; title: string | null; complete: boolean }> = [
    { date: addDaysUTC(today, -21), title: "Kickoff build", complete: true },
    { date: addDaysUTC(today, -14), title: null, complete: false },
    { date: addDaysUTC(today, -7), title: "Shooter tuning", complete: true },
    { date: addDaysUTC(today, -2), title: null, complete: false },
    { date: today, title: "Today's session", complete: false },
    { date: addDaysUTC(today, 3), title: "Scrimmage prep", complete: false },
  ];
  for (const p of plan) {
    const id = uuid();
    db.meeting_days.push({ id, date: p.date, title: p.title });
    snapshot(id);
    if (p.complete) satisfyDay(id);
    else {
      db.attendance.push({ id: uuid(), meeting_day_id: id, member_id: "m1", present: 1 });
    }
  }

  const firstGreenDay = db.meeting_days[0].id;
  db.submissions.push(
    { id: uuid(), meeting_day_id: firstGreenDay, requirement_id: null, kind: "build_need", subsystem: "Shooter", content: "Need spare flywheel belts ordered.", created_by: "ben@demo.app", created_at: `${db.meeting_days[0].date}T19:00:00Z`, resolved: 0 },
    { id: uuid(), meeting_day_id: firstGreenDay, requirement_id: null, kind: "build_need", subsystem: "Programming", content: "Vision pipeline FPS too low.", created_by: "dev@demo.app", created_at: `${db.meeting_days[0].date}T19:05:00Z`, resolved: 1 },
  );

  db.deadlines.push(
    { id: uuid(), title: "Submit chairman's essay", description: "Final draft to mentors", category: "strategy", due_date: addDaysUTC(today, -5), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Order competition parts", description: null, category: "other", due_date: addDaysUTC(today, 3), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Sponsor thank-you posts", description: null, category: "social_media", due_date: addDaysUTC(today, 18), status: "open", completed_at: null, link: null },
    { id: uuid(), title: "Pit banner design", description: "Approved by team", category: "design", due_date: addDaysUTC(today, -10), status: "done", completed_at: `${addDaysUTC(today, -12)}T00:00:00Z`, link: null },
    { id: uuid(), title: "Register for district event", description: null, category: "other", due_date: addDaysUTC(today, 25), status: "open", completed_at: null, link: "https://example.org/register" },
  );

  return db;
}
