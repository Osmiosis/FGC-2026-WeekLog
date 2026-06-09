import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import { deriveDay, dayStatusFromDerived, todayUTC } from "../dayStatus";

// Search across submissions with optional filters (PRD 6.6).
export const search = new Hono<{ Bindings: Env; Variables: Variables }>();

interface Row {
  id: string;
  meeting_day_id: string;
  kind: string;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string | null;
  resolved: number;
  date: string;
  day_id: string;
}

search.get("/", requireUser, async (c) => {
  const q = c.req.query("q");
  const subsystem = c.req.query("subsystem");
  const kind = c.req.query("kind");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const status = c.req.query("status"); // optional RAG filter on the day

  const where: string[] = [];
  const args: unknown[] = [];
  if (q) {
    where.push("s.content LIKE ?");
    args.push(`%${q}%`);
  }
  if (subsystem) {
    where.push("s.subsystem = ?");
    args.push(subsystem);
  }
  if (kind) {
    where.push("s.kind = ?");
    args.push(kind);
  }
  if (from) {
    where.push("md.date >= ?");
    args.push(from);
  }
  if (to) {
    where.push("md.date <= ?");
    args.push(to);
  }

  const sql =
    "SELECT s.*, md.date AS date, md.id AS day_id FROM submissions s " +
    "JOIN meeting_days md ON md.id = s.meeting_day_id " +
    (where.length ? `WHERE ${where.join(" AND ")} ` : "") +
    "ORDER BY md.date DESC, s.created_at DESC";
  const { results } = await c.env.DB.prepare(sql).bind(...args).all<Row>();

  let rows = results;
  if (status) {
    const today = todayUTC();
    const byDay = new Map<string, string>();
    for (const dayId of [...new Set(rows.map((r) => r.day_id))]) {
      const derived = await deriveDay(c.env, dayId);
      const sample = rows.find((r) => r.day_id === dayId)!;
      byDay.set(dayId, dayStatusFromDerived(sample.date, today, derived));
    }
    rows = rows.filter((r) => byDay.get(r.day_id) === status);
  }
  return c.json(rows);
});

// Aggregated build needs (PRD 6.6 "Open Build Needs").
export const buildNeeds = new Hono<{ Bindings: Env; Variables: Variables }>();

buildNeeds.get("/", requireUser, async (c) => {
  const openOnly = c.req.query("open") === "1";
  const sql =
    "SELECT s.*, md.date AS date FROM submissions s " +
    "JOIN meeting_days md ON md.id = s.meeting_day_id " +
    "WHERE s.kind = 'build_need' " +
    (openOnly ? "AND s.resolved = 0 " : "") +
    "ORDER BY md.date DESC";
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json(results);
});
