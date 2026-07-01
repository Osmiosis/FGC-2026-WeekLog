import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import type { NotebookReportsMap, NotebookReport, ReportKind } from "@weeklog/types";

// Notebook Prep API (mounted at /api/notebook).
export const notebook = new Hono<{ Bindings: Env; Variables: Variables }>();

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
