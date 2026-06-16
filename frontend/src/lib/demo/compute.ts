// frontend/src/lib/demo/compute.ts
// Pure derivation logic ported verbatim from worker/src/{compliance,status,dayStatus}.ts,
// re-expressed over the in-browser DemoDB arrays instead of D1 SQL.
import type { DemoDB, MeetingRequirementRow } from "./types";

export type Rag = "green" | "amber" | "red";

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetweenUTC(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function addDaysUTC(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayRag(input: { date: string; today: string; compulsoryTotal: number; compulsorySatisfied: number }): Rag {
  const { date, today, compulsoryTotal, compulsorySatisfied } = input;
  if (compulsoryTotal === 0 || compulsorySatisfied >= compulsoryTotal) return "green";
  if (date < today) return "red";
  return "amber";
}

export function deadlineRag(input: { status: string; due_date: string; today: string }): Rag {
  if (input.status === "done") return "green";
  if (input.due_date < input.today) return "red";
  if (daysBetweenUTC(input.today, input.due_date) <= 7) return "amber";
  return "green";
}

const TEXT_KINDS = new Set(["accomplishment", "build_need", "performance_goal", "failure", "note"]);

export interface DerivedReq extends MeetingRequirementRow {
  status: "submitted" | "missing";
}

interface SubCtx { requirement_id: string | null; kind: string }
interface MedCtx { requirement_id: string | null }

export function deriveRequirementStatus(
  reqs: MeetingRequirementRow[],
  ctx: { presentCount: number; submissions: SubCtx[]; media: MedCtx[] }
): { requirements: DerivedReq[]; missingCompulsory: DerivedReq[] } {
  const requirements: DerivedReq[] = reqs.map((r) => ({ ...r, status: isSatisfied(r, ctx) ? "submitted" : "missing" }));
  const missingCompulsory = requirements.filter((r) => r.compulsory === 1 && r.status === "missing");
  return { requirements, missingCompulsory };
}

function isSatisfied(r: MeetingRequirementRow, ctx: { presentCount: number; submissions: SubCtx[]; media: MedCtx[] }): boolean {
  if (r.expected_kind === "attendance") return ctx.presentCount > 0;
  if (ctx.submissions.some((s) => s.requirement_id === r.id)) return true;
  if (ctx.media.some((m) => m.requirement_id === r.id)) return true;
  if (r.expected_kind === "media") return ctx.media.some((m) => m.requirement_id == null);
  if (r.expected_kind === "text") return ctx.submissions.some((s) => s.requirement_id == null && TEXT_KINDS.has(s.kind));
  if (r.expected_kind === "any") return ctx.submissions.length > 0 || ctx.media.length > 0;
  return false;
}

// Equivalent of worker deriveDay(): pull this day's live context from the arrays.
export function deriveDay(db: DemoDB, dayId: string): { requirements: DerivedReq[]; missingCompulsory: DerivedReq[] } {
  const reqs = db.meeting_requirements
    .filter((r) => r.meeting_day_id === dayId && r.active === 1)
    .sort((a, b) => (b.compulsory - a.compulsory) || a.label.localeCompare(b.label));
  const presentCount = db.attendance.filter((a) => a.meeting_day_id === dayId && a.present === 1).length;
  const submissions = db.submissions.filter((s) => s.meeting_day_id === dayId).map((s) => ({ requirement_id: s.requirement_id, kind: s.kind }));
  const media = db.media.filter((m) => m.meeting_day_id === dayId).map((m) => ({ requirement_id: m.requirement_id }));
  return deriveRequirementStatus(reqs, { presentCount, submissions, media });
}

export function dayStatusFromDerived(date: string, today: string, derived: { requirements: DerivedReq[] }): Rag {
  const compulsory = derived.requirements.filter((r) => r.compulsory === 1);
  const satisfied = compulsory.filter((r) => r.status === "submitted").length;
  return dayRag({ date, today, compulsoryTotal: compulsory.length, compulsorySatisfied: satisfied });
}

// Committee names (sorted) for a member, mirroring the Worker's GROUP_CONCAT + split.
export function committeesOf(db: DemoDB, memberId: string): string[] {
  const ids = db.member_committees.filter((mc) => mc.member_id === memberId).map((mc) => mc.committee_id);
  return db.committees.filter((c) => ids.includes(c.id)).map((c) => c.name).sort();
}
