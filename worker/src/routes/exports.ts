import { Hono } from "hono";
import { zipSync } from "fflate";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import { cleanFileName, sanitizeFolder, uniquePath } from "../names";

// Bulk exports (mounted at /api/export).
export const exports = new Hono<{ Bindings: Env; Variables: Variables }>();

interface MediaJoin {
  r2_key: string;
  meeting_day_id: string | null;
  deadline_id: string | null;
  day_date: string | null;
  day_title: string | null;
  dl_title: string | null;
  dl_due: string | null;
}

// All media in one ZIP, foldered by meeting date (or deadline title) with
// human-readable file names.
exports.get("/all-media/zip", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT m.r2_key, m.meeting_day_id, m.deadline_id,
            md.date AS day_date, md.title AS day_title,
            dl.title AS dl_title, dl.due_date AS dl_due
     FROM media m
     LEFT JOIN meeting_days md ON md.id = m.meeting_day_id
     LEFT JOIN deadlines dl ON dl.id = m.deadline_id
     ORDER BY md.date, dl.due_date`
  ).all<MediaJoin>();

  const files: Record<string, Uint8Array> = {};
  for (const m of results) {
    const obj = await c.env.MEDIA.get(m.r2_key);
    if (!obj) continue;

    let folder: string;
    if (m.meeting_day_id) {
      const name = m.day_title ? `${m.day_date} - ${sanitizeFolder(m.day_title)}` : m.day_date ?? "unknown-date";
      folder = `meetings/${name}`;
    } else if (m.deadline_id) {
      folder = `deadlines/${sanitizeFolder(m.dl_title ?? m.dl_due ?? "deadline")}`;
    } else {
      folder = "other";
    }

    const path = uniquePath(files, `${folder}/${cleanFileName(m.r2_key)}`);
    files[path] = new Uint8Array(await obj.arrayBuffer());
  }

  const zipped = zipSync(files, { level: 0 });
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="all-media.zip"',
    },
  });
});
