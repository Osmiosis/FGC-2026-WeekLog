import { Hono } from "hono";
import { zipSync } from "fflate";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";

// Bulk exports (mounted at /api/export).
export const exports = new Hono<{ Bindings: Env; Variables: Variables }>();

// All media in one ZIP, organized by meeting day or deadline.
exports.get("/all-media/zip", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, meeting_day_id, deadline_id, r2_key FROM media ORDER BY uploaded_at"
  ).all<{
    id: string;
    meeting_day_id: string | null;
    deadline_id: string | null;
    r2_key: string;
  }>();

  const files: Record<string, Uint8Array> = {};
  for (const m of results) {
    const obj = await c.env.MEDIA.get(m.r2_key);
    if (!obj) continue;
    const folder = m.meeting_day_id
      ? `days/${m.meeting_day_id}`
      : m.deadline_id
      ? `deadlines/${m.deadline_id}`
      : "other";
    files[`${folder}/${m.r2_key.split("/").pop()}`] = new Uint8Array(await obj.arrayBuffer());
  }

  const zipped = zipSync(files, { level: 0 });
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="all-media.zip"',
    },
  });
});
