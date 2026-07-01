// Notebook Prep pipeline: the shared JSON contract between the worker (which
// produces reports) and the frontend (which renders them). Defined once here so
// the two sides cannot drift out of sync.

export type ReportKind = "timeline" | "gaps" | "decisions" | "scaffold";

// DB-native submission kinds that carry notebook content. Verbatim, no remapping.
export type TimelineEntryKind =
  | "accomplishment"
  | "failure"
  | "build_need"
  | "performance_goal"
  | "note";

export interface TimelineEntry {
  date: string; // YYYY-MM-DD
  kind: TimelineEntryKind;
  text: string; // the team's own logged words, verbatim
  created_by: string | null;
}

export interface TimelineSubsystem {
  name: string; // "Shooter", "Drivetrain/Collector", "Uncategorized", ...
  entries: TimelineEntry[];
}

export interface TimelinePhotoDay {
  date: string; // YYYY-MM-DD
  photos: Array<{ caption: string; kind: string }>; // metadata only, no bytes
}

export interface TimelinePayload {
  subsystems: TimelineSubsystem[];
  photosByDate: TimelinePhotoDay[];
}

// Widens as later report kinds land (gaps, decisions, scaffold).
export type ReportPayload = TimelinePayload;

export interface NotebookReport {
  id: string;
  kind: ReportKind;
  generated_at: string; // ISO
  payload: ReportPayload;
}

export type ReportRequestStatus = "pending" | "fulfilled";

export interface ReportRequest {
  id: string;
  kind: ReportKind;
  requested_by: string;
  requested_at: string; // ISO
  status: ReportRequestStatus;
  fulfilled_at: string | null;
}

// GET /api/notebook/reports response: latest report per kind (absent kinds omitted).
export type NotebookReportsMap = Partial<Record<ReportKind, NotebookReport>>;

// GET /api/notebook/requests response: one summary row per kind with pending requests.
export interface PendingRequestSummary {
  kind: ReportKind;
  count: number;
  latest_requested_at: string;
}
