// Derive per-requirement submitted/missing status for a single meeting day.
// This is the day-scoped subset of PRD 6.1. Day-level RAG + caching is Phase 5.

const TEXT_KINDS = new Set([
  "accomplishment",
  "build_need",
  "performance_goal",
  "failure",
  "note",
]);

export interface ReqRow {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
  status: string;
}
interface SubRow {
  requirement_id: string | null;
  kind: string;
}
interface MediaRow {
  requirement_id: string | null;
}

export interface DerivedReq extends ReqRow {
  status: "submitted" | "missing";
}

export function deriveRequirementStatus(
  reqs: ReqRow[],
  ctx: { presentCount: number; submissions: SubRow[]; media: MediaRow[] }
): { requirements: DerivedReq[]; missingCompulsory: DerivedReq[] } {
  const requirements: DerivedReq[] = reqs.map((r) => {
    const satisfied = isSatisfied(r, ctx);
    return { ...r, status: satisfied ? "submitted" : "missing" };
  });
  const missingCompulsory = requirements.filter(
    (r) => r.compulsory === 1 && r.status === "missing"
  );
  return { requirements, missingCompulsory };
}

function isSatisfied(
  r: ReqRow,
  ctx: { presentCount: number; submissions: SubRow[]; media: MediaRow[] }
): boolean {
  if (r.expected_kind === "attendance") return ctx.presentCount > 0;

  // Direct match: something was filed against this exact requirement.
  if (ctx.submissions.some((s) => s.requirement_id === r.id)) return true;
  if (ctx.media.some((m) => m.requirement_id === r.id)) return true;

  // Kind fallback for items filed without choosing a requirement.
  if (r.expected_kind === "media") {
    return ctx.media.some((m) => m.requirement_id == null);
  }
  if (r.expected_kind === "text") {
    return ctx.submissions.some(
      (s) => s.requirement_id == null && TEXT_KINDS.has(s.kind)
    );
  }
  if (r.expected_kind === "any") {
    return ctx.submissions.length > 0 || ctx.media.length > 0;
  }
  return false;
}
