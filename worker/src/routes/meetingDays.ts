import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import { snapshotRequirements } from "../snapshot";
import { deriveRequirementStatus, type ReqRow } from "../status";

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

// A single meeting day, its requirement checklist with DERIVED submitted/missing
// status, and the list of unmet compulsory requirements ("what's still missing").
meetingDays.get("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const day = await c.env.DB.prepare("SELECT * FROM meeting_days WHERE id=?")
    .bind(id)
    .first();
  if (!day) return c.json({ error: "not found" }, 404);

  const reqs = await c.env.DB.prepare(
    "SELECT id, label, compulsory, expected_kind, status FROM meeting_requirements WHERE meeting_day_id=? ORDER BY compulsory DESC, label"
  )
    .bind(id)
    .all<ReqRow>();
  const present = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM attendance WHERE meeting_day_id=? AND present=1"
  )
    .bind(id)
    .first<{ n: number }>();
  const subs = await c.env.DB.prepare(
    "SELECT requirement_id, kind FROM submissions WHERE meeting_day_id=?"
  )
    .bind(id)
    .all<{ requirement_id: string | null; kind: string }>();
  const med = await c.env.DB.prepare(
    "SELECT requirement_id FROM media WHERE meeting_day_id=?"
  )
    .bind(id)
    .all<{ requirement_id: string | null }>();

  const derived = deriveRequirementStatus(reqs.results, {
    presentCount: present?.n ?? 0,
    submissions: subs.results,
    media: med.results,
  });
  return c.json({
    ...day,
    requirements: derived.requirements,
    missingCompulsory: derived.missingCompulsory,
  });
});

// ---- Attendance (any signed-in user) ----

// Active roster joined with this day's present flags (default absent).
meetingDays.get("/:id/attendance", requireUser, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS member_id, m.name, m.committee, COALESCE(a.present, 0) AS present
     FROM members m
     LEFT JOIN attendance a ON a.member_id = m.id AND a.meeting_day_id = ?
     WHERE m.active = 1
     ORDER BY m.committee, m.name`
  )
    .bind(id)
    .all();
  return c.json(results);
});

meetingDays.post("/:id/attendance", requireUser, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{ member_id?: string; present?: number }>();
  if (!b.member_id) return c.json({ error: "member_id required" }, 400);
  const present = b.present ? 1 : 0;
  const existing = await c.env.DB.prepare(
    "SELECT id FROM attendance WHERE meeting_day_id=? AND member_id=?"
  )
    .bind(id, b.member_id)
    .first<{ id: string }>();
  if (existing) {
    await c.env.DB.prepare("UPDATE attendance SET present=? WHERE id=?")
      .bind(present, existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO attendance (id, meeting_day_id, member_id, present) VALUES (?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), id, b.member_id, present)
      .run();
  }
  return c.json({ ok: true, member_id: b.member_id, present });
});

// ---- Submissions (any signed-in user) ----

meetingDays.get("/:id/submissions", requireUser, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM submissions WHERE meeting_day_id=? ORDER BY created_at DESC"
  )
    .bind(id)
    .all();
  return c.json(results);
});

meetingDays.post("/:id/submissions", requireUser, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{
    kind?: string;
    content?: string;
    subsystem?: string;
    requirement_id?: string;
  }>();
  if (!b.kind) return c.json({ error: "kind required" }, 400);
  const subId = crypto.randomUUID();
  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO submissions (id, meeting_day_id, requirement_id, kind, subsystem, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      subId,
      id,
      b.requirement_id ?? null,
      b.kind,
      b.subsystem ?? null,
      b.content ?? null,
      user.email,
      new Date().toISOString()
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM submissions WHERE id=?")
    .bind(subId)
    .first();
  return c.json(row, 201);
});

// ---- Media to R2 (any signed-in user) ----

meetingDays.get("/:id/media", requireUser, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM media WHERE meeting_day_id=? ORDER BY uploaded_at DESC"
  )
    .bind(id)
    .all();
  return c.json(results);
});

meetingDays.post("/:id/media", requireUser, async (c) => {
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  const file = form["file"];
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);

  const str = (k: string) => (typeof form[k] === "string" ? (form[k] as string) : null);
  const mediaId = crypto.randomUUID();
  const key = `days/${id}/${mediaId}-${file.name}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer());

  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO media (id, meeting_day_id, deadline_id, requirement_id, subsystem, r2_key, caption, kind, content_type, uploaded_at, uploaded_by) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      mediaId,
      id,
      str("requirement_id"),
      str("subsystem"),
      key,
      str("caption"),
      str("kind"),
      file.type || null,
      new Date().toISOString(),
      user.email
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id=?").bind(mediaId).first();
  return c.json(row, 201);
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
