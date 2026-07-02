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

// Gap analysis (AI-authored offline, published via /publish). Renders as RAG cards.
export type GapStatus = "strong" | "thin" | "missing";
export interface GapCriterion {
  criterion: string; // e.g. "Trade-off analysis"
  status: GapStatus; // strong=green, thin=amber, missing=red
  finding: string; // short, plain-language
  suggestions: string[]; // concrete prompts for a human, never written content
  evidence_refs?: { date: string; subsystem: string }[];
}
export interface GapPayload {
  criteria: GapCriterion[];
}

// Decision worksheet (AI-authored offline, published via /publish). Renders as a checklist.
export type DecisionMissing = "why" | "numbers" | "alternatives" | "result";
export interface Decision {
  title: string; // "Switched 6-wheel to 4-wheel drivetrain"
  date?: string;
  subsystem?: string;
  chosen: string; // what was chosen, taken from logged data
  missing: DecisionMissing[]; // what a human must still add
  prompt: string; // "Explain why 4-wheel won and the numbers behind it"
}
export interface DecisionPayload {
  decisions: Decision[];
}

// Deterministic coverage stats (Worker-computed) that the reasoning interprets.
export interface CoverageSubsystem {
  name: string;
  entries: number;
  failures: number;
  buildNeedsOpen: number;
  buildNeedsResolved: number;
  numericEntries: number; // entries whose content contains a digit
}
export interface CoverageStats {
  subsystems: CoverageSubsystem[];
  photos: { total: number; byKind: Record<string, number> };
  spread: { firstDate: string | null; lastDate: string | null; meetingCount: number; largestGapDays: number };
  totals: { submissions: number; failures: number; numericEntries: number };
}

// Normalized season dump the pipeline reads. Media is metadata only, no bytes.
export interface SeasonExport {
  meetingDays: { id: string; date: string; title: string | null }[];
  submissions: { date: string; subsystem: string | null; kind: string; content: string | null; created_by: string | null }[];
  attendance: { date: string; present: string[] }[];
  deadlines: { title: string; description: string | null; category: string | null; due_date: string; status: string | null }[];
  media: { date: string | null; subsystem: string | null; caption: string | null; kind: string | null; onMeetingDay: boolean }[];
}

// Widens as later report kinds land (gaps, decisions, scaffold).
export type ReportPayload = TimelinePayload | GapPayload | DecisionPayload;

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
