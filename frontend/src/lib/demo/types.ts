// frontend/src/lib/demo/types.ts
// Normalized in-browser mirror of the Worker's D1 tables. Each array is a table.

export interface CommitteeRow { id: string; name: string; sort_order: number }
export interface MemberRow { id: string; name: string; active: number }
export interface MemberCommitteeRow { member_id: string; committee_id: string }
export interface TemplateRow {
  id: string; label: string; description: string | null;
  compulsory: number; expected_kind: string | null; active: number; sort_order: number;
}
export interface MeetingDayRow { id: string; date: string; title: string | null }
export interface MeetingRequirementRow {
  id: string; meeting_day_id: string; template_id: string | null; label: string;
  compulsory: number; expected_kind: string | null; status: string; active: number; custom: number;
}
export interface AttendanceRow { id: string; meeting_day_id: string; member_id: string; present: number }
export interface SubmissionRow {
  id: string; meeting_day_id: string; requirement_id: string | null; kind: string;
  subsystem: string | null; content: string | null; created_by: string | null;
  created_at: string; resolved: number;
}
export interface MediaRow {
  id: string; meeting_day_id: string | null; deadline_id: string | null; requirement_id: string | null;
  subsystem: string | null; caption: string | null; kind: string | null;
  content_type: string | null; uploaded_by: string | null; uploaded_at: string;
}
export interface DeadlineRow {
  id: string; title: string; description: string | null; category: string | null;
  due_date: string; status: string; completed_at: string | null; link: string | null;
}

export interface DemoDB {
  committees: CommitteeRow[];
  members: MemberRow[];
  member_committees: MemberCommitteeRow[];
  templates: TemplateRow[];
  meeting_days: MeetingDayRow[];
  meeting_requirements: MeetingRequirementRow[];
  attendance: AttendanceRow[];
  submissions: SubmissionRow[];
  media: MediaRow[];
  deadlines: DeadlineRow[];
}
