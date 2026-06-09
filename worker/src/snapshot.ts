import type { Env } from "./bindings";

// Copy the currently active requirement templates into a meeting day's
// requirement checklist. Called when a day is marked. The snapshot freezes
// the day's requirements so later template edits never rewrite history.
export async function snapshotRequirements(
  env: Env,
  meetingDayId: string
): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT id, label, compulsory, expected_kind FROM requirement_templates WHERE active=1 ORDER BY sort_order"
  ).all<{
    id: string;
    label: string;
    compulsory: number;
    expected_kind: string | null;
  }>();

  for (const t of results) {
    await env.DB.prepare(
      "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status) VALUES (?, ?, ?, ?, ?, ?, 'missing')"
    )
      .bind(crypto.randomUUID(), meetingDayId, t.id, t.label, t.compulsory, t.expected_kind)
      .run();
  }
  return results.length;
}
