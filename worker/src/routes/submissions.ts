import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, isAdmin } from "../auth";

export const submissions = new Hono<{ Bindings: Env; Variables: Variables }>();

// Delete a submission. The author or the admin may remove it.
submissions.delete("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT created_by FROM submissions WHERE id=?")
    .bind(id)
    .first<{ created_by: string | null }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isAdmin(c.env, user) && row.created_by !== user.email) {
    return c.json({ error: "forbidden" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM submissions WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});
