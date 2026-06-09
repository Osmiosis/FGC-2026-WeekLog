import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import { snapshotRequirements } from "../snapshot";
import {
  deriveDay,
  recomputeDayCache,
  dayStatusFromDerived,
  todayUTC,
} from "../dayStatus";
import { zipSync, strToU8 } from "fflate";
import { buildDaySummary } from "../summary";
import { checkStorageBudget } from "../storage";
import { cleanFileName, uniquePath } from "../names";

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
// Each day carries its derived red/amber/green status.
meetingDays.get("/", requireUser, async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  let rows;
  if (from && to) {
    rows = await c.env.DB.prepare(
      "SELECT * FROM meeting_days WHERE date >= ? AND date <= ? ORDER BY date"
    )
      .bind(from, to)
      .all<{ id: string; date: string }>();
  } else {
    rows = await c.env.DB.prepare("SELECT * FROM meeting_days ORDER BY date").all<{
      id: string;
      date: string;
    }>();
  }
  const today = todayUTC();
  const withStatus = await Promise.all(
    rows.results.map(async (d) => {
      const derived = await deriveDay(c.env, d.id);
      return { ...d, status: dayStatusFromDerived(d.date, today, derived) };
    })
  );
  return c.json(withStatus);
});

// A single meeting day, its requirement checklist with DERIVED submitted/missing
// status, and the list of unmet compulsory requirements ("what's still missing").
meetingDays.get("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const day = await c.env.DB.prepare("SELECT * FROM meeting_days WHERE id=?")
    .bind(id)
    .first<{ date: string } & Record<string, unknown>>();
  if (!day) return c.json({ error: "not found" }, 404);

  // Derive + refresh the cache so viewing a day self-heals its cached status.
  const derived = await recomputeDayCache(c.env, id);
  const status = dayStatusFromDerived(day.date, todayUTC(), derived);
  return c.json({
    ...day,
    status,
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
  await recomputeDayCache(c.env, id);
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
  await recomputeDayCache(c.env, id);
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
  const buf = await file.arrayBuffer();
  const budget = await checkStorageBudget(c.env, buf.byteLength);
  if (!budget.ok) return c.json({ error: budget.error }, budget.status);

  const mediaId = crypto.randomUUID();
  const key = `days/${id}/${mediaId}-${file.name}`;
  await c.env.MEDIA.put(key, buf);

  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO media (id, meeting_day_id, deadline_id, requirement_id, subsystem, r2_key, caption, kind, content_type, bytes, uploaded_at, uploaded_by) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
      buf.byteLength,
      new Date().toISOString(),
      user.email
    )
    .run();
  await recomputeDayCache(c.env, id);
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id=?").bind(mediaId).first();
  return c.json(row, 201);
});

// ---- Per-meeting requirement editing (admin) ----

const REQ_KINDS = new Set(["attendance", "text", "media", "any"]);

// Toggle a single requirement compulsory <-> voluntary for this meeting only.
meetingDays.patch("/:id/requirements/:reqId", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const reqId = c.req.param("reqId");
  const b = await c.req.json<{ compulsory?: number }>();
  if (b.compulsory !== 0 && b.compulsory !== 1) {
    return c.json({ error: "compulsory must be 0 or 1" }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT id FROM meeting_requirements WHERE id=? AND meeting_day_id=? AND active=1"
  )
    .bind(reqId, id)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare("UPDATE meeting_requirements SET compulsory=? WHERE id=?")
    .bind(b.compulsory, reqId)
    .run();
  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements });
});

// Soft-remove a requirement from this meeting. Keeps any linked media/submissions
// in the database; the requirement simply leaves the checklist and RAG count.
meetingDays.delete("/:id/requirements/:reqId", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const reqId = c.req.param("reqId");
  const row = await c.env.DB.prepare(
    "SELECT id FROM meeting_requirements WHERE id=? AND meeting_day_id=? AND active=1"
  )
    .bind(reqId, id)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare("UPDATE meeting_requirements SET active=0 WHERE id=?")
    .bind(reqId)
    .run();
  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements });
});

// Active templates not currently on this meeting — populates the "add default" picker.
meetingDays.get("/:id/requirements/available", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.label, t.compulsory, t.expected_kind
     FROM requirement_templates t
     WHERE t.active = 1
       AND NOT EXISTS (
         SELECT 1 FROM meeting_requirements r
         WHERE r.meeting_day_id = ? AND r.template_id = t.id AND r.active = 1
       )
     ORDER BY t.sort_order`
  )
    .bind(id)
    .all();
  return c.json(results);
});

// Add a requirement to this meeting: re-add a template default (reactivate a
// soft-removed snapshot, else snapshot fresh) or add a custom one-off.
meetingDays.post("/:id/requirements", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{
    templateId?: string;
    label?: string;
    compulsory?: number;
    expectedKind?: string;
  }>();

  const day = await c.env.DB.prepare("SELECT id FROM meeting_days WHERE id=?").bind(id).first();
  if (!day) return c.json({ error: "not found" }, 404);

  if (b.templateId) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM meeting_requirements WHERE meeting_day_id=? AND template_id=?"
    )
      .bind(id, b.templateId)
      .first<{ id: string }>();
    if (existing) {
      await c.env.DB.prepare("UPDATE meeting_requirements SET active=1 WHERE id=?")
        .bind(existing.id)
        .run();
    } else {
      const t = await c.env.DB.prepare(
        "SELECT label, compulsory, expected_kind FROM requirement_templates WHERE id=? AND active=1"
      )
        .bind(b.templateId)
        .first<{ label: string; compulsory: number; expected_kind: string | null }>();
      if (!t) return c.json({ error: "template not found" }, 404);
      await c.env.DB.prepare(
        "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status, active, custom) VALUES (?, ?, ?, ?, ?, ?, 'missing', 1, 0)"
      )
        .bind(crypto.randomUUID(), id, b.templateId, t.label, t.compulsory, t.expected_kind)
        .run();
    }
  } else if (b.label) {
    const kind = b.expectedKind ?? "any";
    if (!REQ_KINDS.has(kind)) return c.json({ error: "invalid expectedKind" }, 400);
    const compulsory = b.compulsory ? 1 : 0;
    await c.env.DB.prepare(
      "INSERT INTO meeting_requirements (id, meeting_day_id, template_id, label, compulsory, expected_kind, status, active, custom) VALUES (?, ?, NULL, ?, ?, ?, 'missing', 1, 1)"
    )
      .bind(crypto.randomUUID(), id, b.label, compulsory, kind)
      .run();
  } else {
    return c.json({ error: "templateId or label required" }, 400);
  }

  const derived = await recomputeDayCache(c.env, id);
  return c.json({ ok: true, requirements: derived.requirements }, 201);
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

// Unmark a meeting day: remove all of its content (media in R2 + rows), then the
// day itself. Children must go before the day to satisfy foreign keys, and media
// and submissions must go before meeting_requirements (they reference it).
meetingDays.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");

  const med = await c.env.DB.prepare("SELECT r2_key FROM media WHERE meeting_day_id=?")
    .bind(id)
    .all<{ r2_key: string }>();
  for (const m of med.results) {
    await c.env.MEDIA.delete(m.r2_key);
  }

  await c.env.DB.prepare("DELETE FROM media WHERE meeting_day_id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM submissions WHERE meeting_day_id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM attendance WHERE meeting_day_id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM meeting_requirements WHERE meeting_day_id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM meeting_days WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});

// Download a day as a ZIP: media files plus summary.md and summary.json.
meetingDays.get("/:id/zip", requireUser, async (c) => {
  const id = c.req.param("id");
  const summary = await buildDaySummary(c.env, id);
  if (!summary) return c.json({ error: "not found" }, 404);

  const files: Record<string, Uint8Array> = {
    "summary.md": strToU8(summary.markdown),
    "summary.json": strToU8(JSON.stringify(summary.json, null, 2)),
  };
  for (const m of summary.mediaRows) {
    const obj = await c.env.MEDIA.get(m.r2_key);
    if (obj) {
      const path = uniquePath(files, `media/${cleanFileName(m.r2_key)}`);
      files[path] = new Uint8Array(await obj.arrayBuffer());
    }
  }
  const zipped = zipSync(files, { level: 0 });
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="meeting-${id}.zip"`,
    },
  });
});
