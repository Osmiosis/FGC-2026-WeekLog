import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import { snapshotRequirements } from "../snapshot";

export const meetingDays = new Hono<{ Bindings: Env; Variables: Variables }>();

// UTC weekday (0=Sun..6=Sat) for an ISO YYYY-MM-DD date, timezone-stable.
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// Inclusive list of ISO dates from start to end.
function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur.getTime() <= last.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// List meeting days, optionally within a [from, to] range (for the calendar).
meetingDays.get("/", requireUser, async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  let rows;
  if (from && to) {
    rows = await c.env.DB.prepare(
      "SELECT * FROM meeting_days WHERE date >= ? AND date <= ? ORDER BY date"
    )
      .bind(from, to)
      .all();
  } else {
    rows = await c.env.DB.prepare("SELECT * FROM meeting_days ORDER BY date").all();
  }
  return c.json(rows.results);
});

// A single meeting day plus its snapshotted requirement checklist.
meetingDays.get("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const day = await c.env.DB.prepare("SELECT * FROM meeting_days WHERE id=?")
    .bind(id)
    .first();
  if (!day) return c.json({ error: "not found" }, 404);
  const reqs = await c.env.DB.prepare(
    "SELECT * FROM meeting_requirements WHERE meeting_day_id=? ORDER BY compulsory DESC, label"
  )
    .bind(id)
    .all();
  return c.json({ ...day, requirements: reqs.results });
});

// Bulk-mark a recurring pattern (e.g. every Tue + Thu over a date range).
// Registered before "/:id" matters not (distinct static segment).
meetingDays.post("/bulk", requireAdmin, async (c) => {
  const b = await c.req.json<{ start?: string; end?: string; weekdays?: number[]; title?: string }>();
  if (!b.start || !b.end || !Array.isArray(b.weekdays) || b.weekdays.length === 0) {
    return c.json({ error: "start, end, and non-empty weekdays are required" }, 400);
  }
  const user = c.get("user");
  const wanted = new Set(b.weekdays);
  let created = 0;
  let skipped = 0;
  for (const date of dateRange(b.start, b.end)) {
    if (!wanted.has(weekdayOf(date))) continue;
    const existing = await c.env.DB.prepare("SELECT id FROM meeting_days WHERE date=?")
      .bind(date)
      .first();
    if (existing) {
      skipped++;
      continue;
    }
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO meeting_days (id, date, title, note, created_by) VALUES (?, ?, ?, NULL, ?)"
    )
      .bind(id, date, b.title ?? null, user.email)
      .run();
    await snapshotRequirements(c.env, id);
    created++;
  }
  return c.json({ created, skipped });
});

// Mark a single day as a meeting day and snapshot its requirements.
meetingDays.post("/", requireAdmin, async (c) => {
  const b = await c.req.json<{ date?: string; title?: string; note?: string }>();
  if (!b.date) return c.json({ error: "date required" }, 400);
  const existing = await c.env.DB.prepare("SELECT id FROM meeting_days WHERE date=?")
    .bind(b.date)
    .first();
  if (existing) return c.json({ error: "already a meeting day" }, 409);

  const user = c.get("user");
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO meeting_days (id, date, title, note, created_by) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, b.date, b.title ?? null, b.note ?? null, user.email)
    .run();
  const count = await snapshotRequirements(c.env, id);
  const day = await c.env.DB.prepare("SELECT * FROM meeting_days WHERE id=?").bind(id).first();
  return c.json({ ...(day as object), requirementCount: count }, 201);
});

// Unmark a meeting day: remove its requirement snapshot, then the day.
meetingDays.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM meeting_requirements WHERE meeting_day_id=?")
    .bind(id)
    .run();
  await c.env.DB.prepare("DELETE FROM meeting_days WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});
