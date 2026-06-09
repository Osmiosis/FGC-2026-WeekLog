// Day-level status: load a day's live context, derive requirement statuses,
// persist them to the cache column, and compute the day RAG.
import type { Env } from "./bindings";
import { deriveRequirementStatus, type ReqRow, type DerivedReq } from "./status";
import { dayRag, type Rag } from "./compliance";

interface Derived {
  requirements: DerivedReq[];
  missingCompulsory: DerivedReq[];
}

export async function deriveDay(env: Env, dayId: string): Promise<Derived> {
  const reqs = await env.DB.prepare(
    "SELECT id, label, compulsory, expected_kind, status, custom FROM meeting_requirements WHERE meeting_day_id=? AND active=1 ORDER BY compulsory DESC, label"
  )
    .bind(dayId)
    .all<ReqRow>();
  const present = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM attendance WHERE meeting_day_id=? AND present=1"
  )
    .bind(dayId)
    .first<{ n: number }>();
  const subs = await env.DB.prepare(
    "SELECT requirement_id, kind FROM submissions WHERE meeting_day_id=?"
  )
    .bind(dayId)
    .all<{ requirement_id: string | null; kind: string }>();
  const med = await env.DB.prepare(
    "SELECT requirement_id FROM media WHERE meeting_day_id=?"
  )
    .bind(dayId)
    .all<{ requirement_id: string | null }>();

  return deriveRequirementStatus(reqs.results, {
    presentCount: present?.n ?? 0,
    submissions: subs.results,
    media: med.results,
  });
}

// Derive AND write the cached meeting_requirements.status for the day.
export async function recomputeDayCache(env: Env, dayId: string): Promise<Derived> {
  const derived = await deriveDay(env, dayId);
  for (const r of derived.requirements) {
    await env.DB.prepare("UPDATE meeting_requirements SET status=? WHERE id=?")
      .bind(r.status, r.id)
      .run();
  }
  return derived;
}

export function dayStatusFromDerived(
  date: string,
  today: string,
  derived: Derived
): Rag {
  const compulsory = derived.requirements.filter((r) => r.compulsory === 1);
  const satisfied = compulsory.filter((r) => r.status === "submitted").length;
  return dayRag({
    date,
    today,
    compulsoryTotal: compulsory.length,
    compulsorySatisfied: satisfied,
  });
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
