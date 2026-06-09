import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, isAdmin } from "../auth";
import { recomputeDayCache } from "../dayStatus";

export const submissions = new Hono<{ Bindings: Env; Variables: Variables }>();

// Delete a submission. The author or the admin may remove it.
submissions.delete("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    "SELECT created_by, meeting_day_id FROM submissions WHERE id=?"
  )
    .bind(id)
    .first<{ created_by: string | null; meeting_day_id: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isAdmin(c.env, user) && row.created_by !== user.email) {
    return c.json({ error: "forbidden" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM submissions WHERE id=?").bind(id).run();
  await recomputeDayCache(c.env, row.meeting_day_id);
  return c.json({ ok: true });
});
