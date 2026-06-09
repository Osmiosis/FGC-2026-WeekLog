import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";

export const members = new Hono<{ Bindings: Env; Variables: Variables }>();

// List roster. Any signed-in user can read. ?active=1 hides deactivated members.
members.get("/", requireUser, async (c) => {
  const activeOnly = c.req.query("active") === "1";
  const sql = activeOnly
    ? "SELECT * FROM members WHERE active=1 ORDER BY committee, name"
    : "SELECT * FROM members ORDER BY committee, name";
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json(results);
});

members.post("/", requireAdmin, async (c) => {
  const body = await c.req.json<{ name?: string; committee?: string }>();
  if (!body.name) return c.json({ error: "name required" }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO members (id, name, committee, active) VALUES (?, ?, ?, 1)"
  )
    .bind(id, body.name, body.committee ?? null)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first();
  return c.json(row, 201);
});

members.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    committee?: string;
    active?: number;
  }>();
  const existing = await c.env.DB.prepare("SELECT * FROM members WHERE id=?")
    .bind(id)
    .first<{ name: string; committee: string | null; active: number }>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const name = body.name ?? existing.name;
  const committee = body.committee ?? existing.committee;
  const active = body.active ?? existing.active;
  await c.env.DB.prepare(
    "UPDATE members SET name=?, committee=?, active=? WHERE id=?"
  )
    .bind(name, committee, active, id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first();
  return c.json(row);
});

// Soft deactivate by default (preserves attendance history). ?hard=true removes the row.
members.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const hard = c.req.query("hard") === "true";
  if (hard) {
    await c.env.DB.prepare("DELETE FROM members WHERE id=?").bind(id).run();
    return c.json({ ok: true, deleted: "hard" });
  }
  await c.env.DB.prepare("UPDATE members SET active=0 WHERE id=?").bind(id).run();
  return c.json({ ok: true, deleted: "soft" });
});
