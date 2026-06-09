import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";

export const templates = new Hono<{ Bindings: Env; Variables: Variables }>();

// List requirement templates ordered for display. ?active=1 hides deactivated ones.
templates.get("/", requireUser, async (c) => {
  const activeOnly = c.req.query("active") === "1";
  const sql = activeOnly
    ? "SELECT * FROM requirement_templates WHERE active=1 ORDER BY sort_order"
    : "SELECT * FROM requirement_templates ORDER BY sort_order";
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json(results);
});

templates.post("/", requireAdmin, async (c) => {
  const b = await c.req.json<{
    label?: string;
    description?: string;
    compulsory?: number;
    expected_kind?: string;
  }>();
  if (!b.label) return c.json({ error: "label required" }, 400);
  const id = crypto.randomUUID();
  const maxRow = await c.env.DB.prepare(
    "SELECT MAX(sort_order) AS m FROM requirement_templates"
  ).first<{ m: number | null }>();
  const sortOrder = (maxRow?.m ?? 0) + 1;
  await c.env.DB.prepare(
    "INSERT INTO requirement_templates (id, label, description, compulsory, expected_kind, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)"
  )
    .bind(id, b.label, b.description ?? null, b.compulsory ?? 1, b.expected_kind ?? null, sortOrder)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM requirement_templates WHERE id=?")
    .bind(id)
    .first();
  return c.json(row, 201);
});

// Reorder: accept an ordered array of ids and rewrite sort_order (1-based).
// Registered before /:id is fine (distinct method + static path).
templates.post("/reorder", requireAdmin, async (c) => {
  const b = await c.req.json<{ ids?: string[] }>();
  if (!Array.isArray(b.ids)) return c.json({ error: "ids array required" }, 400);
  let order = 1;
  for (const id of b.ids) {
    await c.env.DB.prepare("UPDATE requirement_templates SET sort_order=? WHERE id=?")
      .bind(order, id)
      .run();
    order++;
  }
  return c.json({ ok: true });
});

templates.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{
    label?: string;
    description?: string;
    compulsory?: number;
    expected_kind?: string;
    active?: number;
    sort_order?: number;
  }>();
  const existing = await c.env.DB.prepare("SELECT * FROM requirement_templates WHERE id=?")
    .bind(id)
    .first<{
      label: string;
      description: string | null;
      compulsory: number;
      expected_kind: string | null;
      active: number;
      sort_order: number | null;
    }>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const label = b.label ?? existing.label;
  const description = b.description ?? existing.description;
  const compulsory = b.compulsory ?? existing.compulsory;
  const expected_kind = b.expected_kind ?? existing.expected_kind;
  const active = b.active ?? existing.active;
  const sort_order = b.sort_order ?? existing.sort_order;
  await c.env.DB.prepare(
    "UPDATE requirement_templates SET label=?, description=?, compulsory=?, expected_kind=?, active=?, sort_order=? WHERE id=?"
  )
    .bind(label, description, compulsory, expected_kind, active, sort_order, id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM requirement_templates WHERE id=?")
    .bind(id)
    .first();
  return c.json(row);
});

// Soft deactivate by default; ?hard=true removes the row.
templates.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const hard = c.req.query("hard") === "true";
  if (hard) {
    await c.env.DB.prepare("DELETE FROM requirement_templates WHERE id=?").bind(id).run();
    return c.json({ ok: true, deleted: "hard" });
  }
  await c.env.DB.prepare("UPDATE requirement_templates SET active=0 WHERE id=?").bind(id).run();
  return c.json({ ok: true, deleted: "soft" });
});
