import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind, TimelinePayload, TimelineEntry, CoverageStats, CoverageSubsystem, SeasonExport } from "@weeklog/types";

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

// Deterministic coverage numbers the reasoning step interprets. Never invented:
// straight counts over the logged submissions and media.
async function buildCoverage(env: Env): Promise<CoverageStats> {
  const committees = (
    await env.DB.prepare("SELECT name FROM committees ORDER BY sort_order, name").all<{ name: string }>()
  ).results.map((r) => r.name);

  const subs = (
    await env.DB.prepare(
      `SELECT subsystem, kind, content, resolved FROM submissions
       WHERE kind IN ('accomplishment','failure','build_need','performance_goal','note')
       ORDER BY subsystem`
    ).all<{ subsystem: string | null; kind: string; content: string | null; resolved: number }>()
  ).results;

  const map = new Map<string, CoverageSubsystem>();
  const ensure = (name: string) => {
    let x = map.get(name);
    if (!x) {
      x = { name, entries: 0, failures: 0, buildNeedsOpen: 0, buildNeedsResolved: 0, numericEntries: 0 };
      map.set(name, x);
    }
    return x;
  };
  let totalFailures = 0;
  let totalNumeric = 0;
  for (const s of subs) {
    const x = ensure(s.subsystem ?? "Uncategorized");
    x.entries++;
    if (s.kind === "failure") {
      x.failures++;
      totalFailures++;
    }
    if (s.kind === "build_need") {
      if (s.resolved) x.buildNeedsResolved++;
      else x.buildNeedsOpen++;
    }
    if (s.content && /\d/.test(s.content)) {
      x.numericEntries++;
      totalNumeric++;
    }
  }
  const ordered: string[] = [];
  for (const n of committees) if (map.has(n)) ordered.push(n);
  for (const n of map.keys()) if (!ordered.includes(n)) ordered.push(n);
  const subsystems = ordered.map((n) => map.get(n)!);

  // Counts all media rows (including deadline media), unlike the Timeline, which
  // only joins media to meeting days.
  const media = (await env.DB.prepare("SELECT kind FROM media").all<{ kind: string | null }>()).results;
  const byKind: Record<string, number> = {};
  for (const m of media) {
    const k = m.kind ?? "unknown";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }

  const days = (
    await env.DB.prepare("SELECT date FROM meeting_days ORDER BY date").all<{ date: string }>()
  ).results.map((r) => r.date);
  let largestGapDays = 0;
  for (let i = 1; i < days.length; i++) {
    const d0 = new Date(days[i - 1] + "T00:00:00Z").getTime();
    const d1 = new Date(days[i] + "T00:00:00Z").getTime();
    const gap = Math.round((d1 - d0) / 86400000);
    if (gap > largestGapDays) largestGapDays = gap;
  }

  return {
    subsystems,
    photos: { total: media.length, byKind },
    spread: { firstDate: days[0] ?? null, lastDate: days[days.length - 1] ?? null, meetingCount: days.length, largestGapDays },
    totals: { submissions: subs.length, failures: totalFailures, numericEntries: totalNumeric },
  };
}

// Normalized season dump for the offline reasoning pipeline. Media is metadata
// only (caption, kind, date) so no image bytes ever reach a reasoning step.
async function buildSeason(env: Env): Promise<SeasonExport> {
  const meetingDays = (
    await env.DB.prepare("SELECT id, date, title FROM meeting_days ORDER BY date").all<{ id: string; date: string; title: string | null }>()
  ).results;

  const submissions = (
    await env.DB.prepare(
      `SELECT md.date, s.subsystem, s.kind, s.content, s.created_by
       FROM submissions s JOIN meeting_days md ON md.id = s.meeting_day_id
       ORDER BY md.date, s.created_at`
    ).all<{ date: string; subsystem: string | null; kind: string; content: string | null; created_by: string | null }>()
  ).results;

  const att = (
    await env.DB.prepare(
      `SELECT md.date, m.name FROM attendance a
       JOIN members m ON m.id = a.member_id
       JOIN meeting_days md ON md.id = a.meeting_day_id
       WHERE a.present = 1 ORDER BY md.date, m.name`
    ).all<{ date: string; name: string }>()
  ).results;
  const attByDate = new Map<string, string[]>();
  for (const r of att) {
    const l = attByDate.get(r.date);
    if (l) l.push(r.name);
    else attByDate.set(r.date, [r.name]);
  }
  const attendance = [...attByDate.entries()].map(([date, present]) => ({ date, present }));

  const deadlines = (
    await env.DB.prepare(
      "SELECT title, description, category, due_date, status FROM deadlines ORDER BY due_date"
    ).all<{ title: string; description: string | null; category: string | null; due_date: string; status: string | null }>()
  ).results;

  const mediaRows = (
    await env.DB.prepare(
      `SELECT m.subsystem, m.caption, m.kind, md.date AS mdate, m.meeting_day_id
       FROM media m LEFT JOIN meeting_days md ON md.id = m.meeting_day_id`
    ).all<{ subsystem: string | null; caption: string | null; kind: string | null; mdate: string | null; meeting_day_id: string | null }>()
  ).results;
  const media = mediaRows.map((m) => ({
    date: m.mdate,
    subsystem: m.subsystem,
    caption: m.caption,
    kind: m.kind,
    onMeetingDay: m.meeting_day_id != null,
  }));

  return { meetingDays, submissions, attendance, deadlines, media };
}

notebook.get("/season", requireUser, async (c) => c.json(await buildSeason(c.env)));

// Upsert the single snapshot row for a kind and fulfil that kind's pending
// requests. Shared by the deterministic generate routes and the offline publish.
async function saveReport(env: Env, kind: ReportKind, payload: unknown): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO notebook_reports (id, kind, generated_at, payload)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET id = excluded.id, generated_at = excluded.generated_at, payload = excluded.payload`
  )
    .bind(crypto.randomUUID(), kind, now, JSON.stringify(payload))
    .run();
  await env.DB.prepare(
    "UPDATE notebook_requests SET status = 'fulfilled', fulfilled_at = ? WHERE kind = ? AND status = 'pending'"
  )
    .bind(now, kind)
    .run();
}

// Admin-triggered: compute the timeline, upsert the single snapshot row for its
// kind, and mark all pending timeline requests fulfilled in one shot.
notebook.post("/generate/timeline", requireAdmin, async (c) => {
  const payload = await buildTimeline(c.env);
  await saveReport(c.env, "timeline", payload);
  return c.json(payload);
});

notebook.get("/coverage", requireUser, async (c) => c.json(await buildCoverage(c.env)));

// Offline write-back for reports authored by Claude Code (gaps, decisions,
// scaffold). Gated by a shared secret, not user auth: it is machine-called by the
// pipeline, never the browser. Accepts any kind so later reasoning tabs reuse it.
notebook.post("/publish", async (c) => {
  const secret = c.env.NOTEBOOK_PUBLISH_SECRET;
  if (!secret) return c.json({ error: "publish not configured" }, 503);
  if (c.req.header("X-Notebook-Secret") !== secret) return c.json({ error: "unauthorized" }, 401);
  let body: { kind?: string; payload?: unknown };
  try {
    body = await c.req.json<{ kind?: string; payload?: unknown }>();
  } catch {
    return c.json({ error: "bad payload" }, 400);
  }
  if (!body.kind || !KINDS.includes(body.kind as ReportKind)) return c.json({ error: "unknown kind" }, 400);
  if (body.payload === undefined || body.payload === null) return c.json({ error: "payload required" }, 400);
  await saveReport(c.env, body.kind as ReportKind, body.payload);
  return c.json({ ok: true });
});
