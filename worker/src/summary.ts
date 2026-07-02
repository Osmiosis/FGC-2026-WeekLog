import type { Env } from "./bindings";
import { deriveDay, dayStatusFromDerived, todayUTC } from "./dayStatus";
import { cleanFileName } from "./names";

export interface MediaRow {
  id: string;
  r2_key: string;
  caption: string | null;
  kind: string | null;
  content_type: string | null;
}

// Submission kinds → human headings, in the order we want them in summaries.
// Keep in sync with kindForLabel in the frontend MeetingDayDetail.
const SUBMISSION_SECTIONS: ReadonlyArray<[string, string]> = [
  ["build_need", "Build needs"],
  ["note", "Strategy notes"],
  ["accomplishment", "Accomplishments"],
  ["performance_goal", "Performance goals"],
  ["failure", "Failures & blockers"],
];

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

  const presentRaw = await env.DB.prepare(
    `SELECT m.name, GROUP_CONCAT(c.name, ', ') AS committee FROM attendance a
     JOIN members m ON m.id = a.member_id
     LEFT JOIN member_committees mc ON mc.member_id = m.id
     LEFT JOIN committees c ON c.id = mc.committee_id
     WHERE a.meeting_day_id = ? AND a.present = 1
     GROUP BY m.id
     ORDER BY m.name`
  )
    .bind(dayId)
    .all<{ name: string; committee: string | null }>();
  const present = presentRaw;

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
  // Group submissions by kind so build needs, strategy notes, etc. each get
  // their own section. Unknown kinds fall through to a generic "Other notes".
  lines.push("", "## Notes & submissions");
  const subs = submissions.results;
  const seen = new Set<string>();
  const fmt = (s: { subsystem: string | null; content: string | null; created_by: string | null }) =>
    `- ${s.subsystem ? `(${s.subsystem}) ` : ""}${s.content ?? ""}${s.created_by ? ` (${s.created_by})` : ""}`;
  for (const [kind, heading] of SUBMISSION_SECTIONS) {
    const group = subs.filter((s) => s.kind === kind);
    if (!group.length) continue;
    seen.add(kind);
    lines.push("", `### ${heading}`);
    for (const s of group) lines.push(fmt(s));
  }
  const other = subs.filter((s) => !seen.has(s.kind));
  if (other.length) {
    lines.push("", "### Other notes");
    for (const s of other) lines.push(`- [${s.kind}] ${fmt(s).slice(2)}`);
  }
  if (!subs.length) lines.push("", "_No notes or submissions recorded._");
  lines.push("", "## Media");
  for (const m of media.results) lines.push(`- ${cleanFileName(m.r2_key)}${m.caption ? ` (${m.caption})` : ""}`);

  return { json, markdown: lines.join("\n"), mediaRows: media.results };
}

export interface DeadlineSummaryRow {
  title: string;
  description: string | null;
  category: string | null;
  due_date: string;
  status: string | null;
  link: string | null;
}

// Render a deadline's text content as Markdown for inclusion in the all-media
// ZIP. Deadlines carry no submissions, so this is their metadata + media list.
export function buildDeadlineMarkdown(d: DeadlineSummaryRow, media: MediaRow[]): string {
  const lines: string[] = [];
  lines.push(`# Deadline: ${d.title}`);
  lines.push(`Due: ${d.due_date}`);
  if (d.status) lines.push(`Status: ${d.status}`);
  if (d.category) lines.push(`Category: ${d.category}`);
  if (d.link) lines.push(`Reference: ${d.link}`);
  if (d.description) lines.push("", "## Description", d.description);
  lines.push("", "## Media");
  if (media.length) {
    for (const m of media) lines.push(`- ${cleanFileName(m.r2_key)}${m.caption ? ` (${m.caption})` : ""}`);
  } else {
    lines.push("_No media uploaded._");
  }
  return lines.join("\n");
}
