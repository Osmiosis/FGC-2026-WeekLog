import type { Env } from "./bindings";
import { deriveDay, dayStatusFromDerived, todayUTC } from "./dayStatus";

export interface MediaRow {
  id: string;
  r2_key: string;
  caption: string | null;
  kind: string | null;
  content_type: string | null;
}

// Assemble a meeting day's summary as both a structured object and Markdown,
// plus the media rows (so the caller can pull bytes from R2 for a ZIP).
export async function buildDaySummary(
  env: Env,
  dayId: string
): Promise<{ json: unknown; markdown: string; mediaRows: MediaRow[] } | null> {
  const day = await env.DB.prepare("SELECT * FROM meeting_days WHERE id=?")
    .bind(dayId)
    .first<{ date: string; title: string | null }>();
  if (!day) return null;

  const derived = await deriveDay(env, dayId);
  const status = dayStatusFromDerived(day.date, todayUTC(), derived);

  const present = await env.DB.prepare(
    `SELECT m.name, m.committee FROM attendance a
     JOIN members m ON m.id = a.member_id
     WHERE a.meeting_day_id = ? AND a.present = 1
     ORDER BY m.committee, m.name`
  )
    .bind(dayId)
    .all<{ name: string; committee: string | null }>();

  const submissions = await env.DB.prepare(
    "SELECT kind, subsystem, content, created_by FROM submissions WHERE meeting_day_id=? ORDER BY created_at"
  )
    .bind(dayId)
    .all<{ kind: string; subsystem: string | null; content: string | null; created_by: string | null }>();

  const media = await env.DB.prepare(
    "SELECT id, r2_key, caption, kind, content_type FROM media WHERE meeting_day_id=? ORDER BY uploaded_at"
  )
    .bind(dayId)
    .all<MediaRow>();

  const json = {
    date: day.date,
    title: day.title,
    status,
    requirements: derived.requirements.map((r) => ({ label: r.label, compulsory: r.compulsory, status: r.status })),
    attendancePresent: present.results,
    submissions: submissions.results,
    media: media.results.map((m) => ({ key: m.r2_key, kind: m.kind, caption: m.caption })),
  };

  const lines: string[] = [];
  lines.push(`# Meeting day ${day.date}${day.title ? ` (${day.title})` : ""}`);
  lines.push(`Status: ${status}`, "");
  lines.push("## Requirements");
  for (const r of derived.requirements) {
    lines.push(`- [${r.status === "submitted" ? "x" : " "}] ${r.label}${r.compulsory ? "" : " (optional)"}`);
  }
  lines.push("", "## Attendance (present)");
  for (const p of present.results) lines.push(`- ${p.name}${p.committee ? ` (${p.committee})` : ""}`);
  lines.push("", "## Submissions");
  for (const s of submissions.results) {
    lines.push(`- [${s.kind}]${s.subsystem ? ` (${s.subsystem})` : ""} ${s.content ?? ""}${s.created_by ? ` (${s.created_by})` : ""}`);
  }
  lines.push("", "## Media");
  for (const m of media.results) lines.push(`- ${m.r2_key.split("/").pop()}${m.caption ? ` (${m.caption})` : ""}`);

  return { json, markdown: lines.join("\n"), mediaRows: media.results };
}
