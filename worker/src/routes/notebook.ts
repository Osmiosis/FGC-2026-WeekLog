import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind } from "@weeklog/types";

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
