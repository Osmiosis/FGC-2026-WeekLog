import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind, TimelinePayload, TimelineEntry } from "@weeklog/types";

// Notebook Prep API (mounted at /api/notebook).
export const notebook = new Hono<{ Bindings: Env; Variables: Variables }>();

const KINDS: ReportKind[] = ["timeline", "gaps", "decisions", "scaffold"];

// Latest published snapshot per kind. The view renders whatever is here; it does
// not care whether a row was computed (timeline) or authored offline (later kinds).
notebook.get("/reports", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, kind, generated_at, payload FROM notebook_reports"
  ).all<{ id: string; kind: string; generated_at: string; payload: string }>();

  const map: NotebookReportsMap = {};
  for (const r of results) {
    map[r.kind as ReportKind] = {
      id: r.id,
      kind: r.kind as ReportKind,
      generated_at: r.generated_at,
      payload: JSON.parse(r.payload),
    } as NotebookReport;
  }
  return c.json(map);
});

// A member asks for a report kind to be refreshed. The request sits pending until
// an admin regenerates that kind.
notebook.post("/requests", requireUser, async (c) => {
  const body = await c.req.json<{ kind?: string }>();
  if (!body.kind || !KINDS.includes(body.kind as ReportKind)) {
    return c.json({ error: "unknown kind" }, 400);
  }
  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO notebook_requests (id, kind, requested_by, requested_at, status) VALUES (?, ?, ?, ?, 'pending')"
  )
    .bind(crypto.randomUUID(), body.kind, user.email, new Date().toISOString())
    .run();
  return c.json({ ok: true });
});

// Pending requests grouped by kind, for the admin indicator.
notebook.get("/requests", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT kind, COUNT(*) AS count, MAX(requested_at) AS latest_requested_at
     FROM notebook_requests WHERE status = 'pending' GROUP BY kind ORDER BY kind`
  ).all<{ kind: string; count: number; latest_requested_at: string }>();
  return c.json(results);
});

// Deterministic: assemble per-subsystem chronological threads plus date-keyed
// meeting photos. Subsystem order follows the committees dimension; null-subsystem
// entries fall into "Uncategorized"; photos are metadata only (no bytes).
async function buildTimeline(env: Env): Promise<TimelinePayload> {
  const committees = (
    await env.DB.prepare("SELECT name FROM committees ORDER BY sort_order, name").all<{ name: string }>()
  ).results.map((r) => r.name);

  const subs = (
    await env.DB.prepare(
      `SELECT s.subsystem, s.kind, s.content, s.created_by, md.date
       FROM submissions s JOIN meeting_days md ON md.id = s.meeting_day_id
       WHERE s.kind IN ('accomplishment','failure','build_need','performance_goal','note')
       ORDER BY md.date, s.created_at`
    ).all<{ subsystem: string | null; kind: string; content: string | null; created_by: string | null; date: string }>()
  ).results;

  const bySub = new Map<string, TimelineEntry[]>();
  for (const s of subs) {
    const name = s.subsystem ?? "Uncategorized";
    const entry: TimelineEntry = {
      date: s.date,
      kind: s.kind as TimelineEntry["kind"],
      text: s.content ?? "",
      created_by: s.created_by,
    };
    const list = bySub.get(name);
    if (list) list.push(entry);
    else bySub.set(name, [entry]);
  }

  // Canonical committees first (only those with entries), then any stray or Uncategorized keys.
  const ordered: string[] = [];
  for (const name of committees) if (bySub.has(name)) ordered.push(name);
  for (const name of bySub.keys()) if (!ordered.includes(name)) ordered.push(name);
  const subsystems = ordered.map((name) => ({ name, entries: bySub.get(name)! }));

  const media = (
    await env.DB.prepare(
      `SELECT md.date, m.caption, m.kind
       FROM media m JOIN meeting_days md ON md.id = m.meeting_day_id
       ORDER BY md.date, m.uploaded_at`
    ).all<{ date: string; caption: string | null; kind: string | null }>()
  ).results;

  const byDate = new Map<string, { caption: string; kind: string }[]>();
  for (const m of media) {
    const photo = { caption: m.caption ?? "", kind: m.kind ?? "" };
    const list = byDate.get(m.date);
    if (list) list.push(photo);
    else byDate.set(m.date, [photo]);
  }
  const photosByDate = [...byDate.entries()].map(([date, photos]) => ({ date, photos }));

  return { subsystems, photosByDate };
}

// Admin-triggered: compute the timeline, upsert the single snapshot row for its
// kind, and mark all pending timeline requests fulfilled in one shot.
notebook.post("/generate/timeline", requireAdmin, async (c) => {
  const payload = await buildTimeline(c.env);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO notebook_reports (id, kind, generated_at, payload)
     VALUES (?, 'timeline', ?, ?)
     ON CONFLICT(kind) DO UPDATE SET id = excluded.id, generated_at = excluded.generated_at, payload = excluded.payload`
  )
    .bind(crypto.randomUUID(), now, JSON.stringify(payload))
    .run();
  await c.env.DB.prepare(
    "UPDATE notebook_requests SET status = 'fulfilled', fulfilled_at = ? WHERE kind = 'timeline' AND status = 'pending'"
  )
    .bind(now)
    .run();
  return c.json(payload);
});
