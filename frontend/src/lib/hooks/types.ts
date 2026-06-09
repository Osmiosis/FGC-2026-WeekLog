// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — shared view types returned by the data hooks.
// ─────────────────────────────────────────────────────────────────────────────
export type Rag = "green" | "amber" | "red";

export interface Member {
  id: string;
  name: string;
  committee: string | null;
  active: number;
}

export interface Template {
  id: string;
  label: string;
  description: string | null;
  compulsory: number;
  expected_kind: string | null;
  active: number;
  sort_order: number | null;
}

export interface MeetingDayLite {
  id: string;
  date: string;
  title: string | null;
  status: Rag;
}

export interface Requirement {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
  status: "submitted" | "missing";
}

export interface MeetingDayDetail {
  id: string;
  date: string;
  title: string | null;
  status: Rag;
  requirements: Requirement[];
  missingCompulsory: Array<{ label: string }>;
}

export interface AttendanceRow {
  member_id: string;
  name: string;
  committee: string | null;
  present: number;
}

export interface Submission {
  id: string;
  kind: string;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
  date?: string;
  meeting_day_id?: string;
  day_id?: string;
  resolved?: number;
}

export interface MediaRow {
  id: string;
  caption: string | null;
  kind: string | null;
  content_type: string | null;
  uploaded_by?: string | null;
}

export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string;
  status: string;
  status_rag: Rag;
  link: string | null;
}

export interface Dashboard {
  today: string;
  overall: Rag;
  counts: { daysFlagged: number; deadlinesOverdue: number; deadlinesDueSoon: number };
  needsAttention: Array<{
    type: "day" | "deadline";
    id: string;
    date?: string;
    due_date?: string;
    label: string;
  }>;
  thisWeek: Array<{ id: string; date: string; status: Rag }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    due_date: string;
    status: Rag;
    daysUntil: number;
  }>;
}
