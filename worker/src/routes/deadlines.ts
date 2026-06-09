import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";
import { deadlineRag } from "../compliance";
import { todayUTC } from "../dayStatus";

export const deadlines = new Hono<{ Bindings: Env; Variables: Variables }>();

interface DeadlineRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string;
  status: string;
  completed_at: string | null;
  link: string | null;
}

// List deadlines, each with its derived red/amber/green status.
deadlines.get("/", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM deadlines ORDER BY due_date"
  ).all<DeadlineRow>();
  const today = todayUTC();
  return c.json(
    results.map((d) => ({
      ...d,
      status_rag: deadlineRag({ status: d.status, due_date: d.due_date, today }),
    }))
  );
});

deadlines.post("/", requireAdmin, async (c) => {
  const b = await c.req.json<{
    title?: string;
    description?: string;
    category?: string;
    due_date?: string;
    link?: string;
  }>();
  if (!b.title || !b.due_date) {
    return c.json({ error: "title and due_date required" }, 400);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO deadlines (id, title, description, category, due_date, status, completed_at, link) VALUES (?, ?, ?, ?, ?, 'open', NULL, ?)"
  )
    .bind(id, b.title, b.description ?? null, b.category ?? null, b.due_date, b.link ?? null)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM deadlines WHERE id=?").bind(id).first();
  return c.json(row, 201);
});

deadlines.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<Partial<DeadlineRow>>();
  const existing = await c.env.DB.prepare("SELECT * FROM deadlines WHERE id=?")
    .bind(id)
    .first<DeadlineRow>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const merged = {
    title: b.title ?? existing.title,
    description: b.description ?? existing.description,
    category: b.category ?? existing.category,
    due_date: b.due_date ?? existing.due_date,
    status: b.status ?? existing.status,
    link: b.link ?? existing.link,
  };
  await c.env.DB.prepare(
    "UPDATE deadlines SET title=?, description=?, category=?, due_date=?, status=?, link=? WHERE id=?"
  )
    .bind(merged.title, merged.description, merged.category, merged.due_date, merged.status, merged.link, id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM deadlines WHERE id=?").bind(id).first();
  return c.json(row);
});

deadlines.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM deadlines WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});

// Members may mark a deadline done (and attach proof media separately).
deadlines.post("/:id/done", requireUser, async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM deadlines WHERE id=?")
    .bind(id)
    .first();
  if (!existing) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare(
    "UPDATE deadlines SET status='done', completed_at=? WHERE id=?"
  )
    .bind(new Date().toISOString(), id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM deadlines WHERE id=?").bind(id).first();
  return c.json(row);
});

deadlines.post("/:id/reopen", requireAdmin, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE deadlines SET status='open', completed_at=NULL WHERE id=?"
  )
    .bind(id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM deadlines WHERE id=?").bind(id).first();
  return c.json(row);
});

// Proof media for a deadline (members), stored in R2 like meeting-day media.
deadlines.get("/:id/media", requireUser, async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM media WHERE deadline_id=? ORDER BY uploaded_at DESC"
  )
    .bind(id)
    .all();
  return c.json(results);
});

deadlines.post("/:id/media", requireUser, async (c) => {
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  const file = form["file"];
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  const str = (k: string) => (typeof form[k] === "string" ? (form[k] as string) : null);
  const mediaId = crypto.randomUUID();
  const key = `deadlines/${id}/${mediaId}-${file.name}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer());
  const user = c.get("user");
  await c.env.DB.prepare(
    "INSERT INTO media (id, meeting_day_id, deadline_id, requirement_id, subsystem, r2_key, caption, kind, content_type, uploaded_at, uploaded_by) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)"
  )
    .bind(mediaId, id, key, str("caption"), str("kind"), file.type || null, new Date().toISOString(), user.email)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id=?").bind(mediaId).first();
  return c.json(row, 201);
});
