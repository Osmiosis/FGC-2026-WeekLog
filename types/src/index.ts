// Shared domain types for the FGC 2026 meeting compliance tracker.
// Mirrors the D1 schema in worker/migrations/0001_init.sql.

export type ExpectedKind = "attendance" | "text" | "media" | "any";

export type SubmissionKind =
  | "attendance"
  | "accomplishment"
  | "build_need"
  | "performance_goal"
  | "failure"
  | "note"
  | "media";

export type RequirementStatus = "missing" | "submitted";
export type DeadlineStatus = "open" | "done";
export type DeadlineCategory = "social_media" | "design" | "strategy" | "other";
export type MediaKind = "photo" | "sketch" | "doc" | "video";

// Derived compliance colors used across calendar/dashboard.
export type Rag = "green" | "amber" | "red";

export interface Member {
  id: string;
  name: string;
  committee: string | null;
  active: number;
}

export interface RequirementTemplate {
  id: string;
  label: string;
  description: string | null;
  compulsory: number;
  expected_kind: ExpectedKind | null;
  active: number;
  sort_order: number | null;
}

export interface MeetingDay {
  id: string;
  date: string;
  title: string | null;
  note: string | null;
  created_by: string | null;
}

export interface MeetingRequirement {
  id: string;
  meeting_day_id: string;
  template_id: string | null;
  label: string;
  compulsory: number;
  expected_kind: ExpectedKind | null;
  status: RequirementStatus;
}

export interface Submission {
  id: string;
  meeting_day_id: string;
  requirement_id: string | null;
  kind: SubmissionKind;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface Attendance {
  id: string;
  meeting_day_id: string;
  member_id: string;
  present: number;
}

export interface Media {
  id: string;
  meeting_day_id: string | null;
  deadline_id: string | null;
  requirement_id: string | null;
  subsystem: string | null;
  r2_key: string;
  caption: string | null;
  kind: MediaKind | null;
  content_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  category: DeadlineCategory | null;
  due_date: string;
  status: DeadlineStatus;
  completed_at: string | null;
  link: string | null;
}
