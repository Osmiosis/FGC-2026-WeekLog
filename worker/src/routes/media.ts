import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, isAdmin } from "../auth";

export const media = new Hono<{ Bindings: Env; Variables: Variables }>();

// Stream a media file back from R2 (authed). Simpler than presigning on the binding.
media.get("/:id/file", requireUser, async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT r2_key, content_type FROM media WHERE id=?"
  )
    .bind(id)
    .first<{ r2_key: string; content_type: string | null }>();
  if (!row) return c.json({ error: "not found" }, 404);
  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ error: "file missing" }, 404);
  return new Response(obj.body, {
    headers: { "Content-Type": row.content_type ?? "application/octet-stream" },
  });
});

// Delete a media item (uploader or admin): remove the R2 object then the row.
media.delete("/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    "SELECT r2_key, uploaded_by FROM media WHERE id=?"
  )
    .bind(id)
    .first<{ r2_key: string; uploaded_by: string | null }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isAdmin(c.env, user) && row.uploaded_by !== user.email) {
    return c.json({ error: "forbidden" }, 403);
  }
  await c.env.MEDIA.delete(row.r2_key);
  await c.env.DB.prepare("DELETE FROM media WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});
