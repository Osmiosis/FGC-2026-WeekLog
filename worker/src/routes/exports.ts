import { Hono } from "hono";
import { strToU8 } from "fflate";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import { cleanFileName, sanitizeFolder, uniquePath } from "../names";
import { buildDaySummary, buildDeadlineMarkdown, type MediaRow } from "../summary";
import { streamZip, type ZipEntry } from "../zipStream";

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

// Folder names must match between media bytes and the text summary so each
// meeting/deadline's files land together.
function meetingFolder(date: string | null, title: string | null): string {
  const name = title ? `${date} - ${sanitizeFolder(title)}` : date ?? "unknown-date";
  return `meetings/${name}`;
}
function deadlineFolder(title: string | null, due: string | null): string {
  return `deadlines/${sanitizeFolder(title ?? due ?? "deadline")}`;
}

// Everything in one ZIP: media foldered by meeting date (or deadline title)
// alongside a summary.md / summary.json per meeting and a summary.md per
// deadline, so strategy notes, build needs, accomplishments, etc. travel with
// the photos.
exports.get("/all-media/zip", requireUser, async (c) => {
  // Build the entry manifest first (metadata only — cheap). Media bytes are
  // pulled from R2 one at a time while the ZIP streams out, so the whole archive
  // never sits in memory at once. The old approach buffered every file plus the
  // full zipSync output simultaneously, which OOMs the 128 MB Worker isolate —
  // Cloudflare then kills the request with an HTML 503 that never reaches our
  // onError handler.
  const used: Record<string, true> = {};
  const reserve = (path: string) => {
    const p = uniquePath(used, path);
    used[p] = true;
    return p;
  };

  const entries: ZipEntry[] = [];

  // 1. Media (bytes resolved lazily during streaming below).
  const { results } = await c.env.DB.prepare(
    `SELECT m.r2_key, m.meeting_day_id, m.deadline_id,
            md.date AS day_date, md.title AS day_title,
            dl.title AS dl_title, dl.due_date AS dl_due
     FROM media m
     LEFT JOIN meeting_days md ON md.id = m.meeting_day_id
     LEFT JOIN deadlines dl ON dl.id = m.deadline_id
     ORDER BY md.date, dl.due_date`
  ).all<MediaJoin>();
  for (const m of results) {
    let folder: string;
    if (m.meeting_day_id) folder = meetingFolder(m.day_date, m.day_title);
    else if (m.deadline_id) folder = deadlineFolder(m.dl_title, m.dl_due);
    else folder = "other";
    entries.push({ path: reserve(`${folder}/${cleanFileName(m.r2_key)}`), r2Key: m.r2_key });
  }

  // 2. Per-meeting text summaries (every day, even ones with no media).
  const days = await c.env.DB.prepare(
    "SELECT id, date, title FROM meeting_days ORDER BY date"
  ).all<{ id: string; date: string; title: string | null }>();
  for (const d of days.results) {
    const summary = await buildDaySummary(c.env, d.id);
    if (!summary) continue;
    const folder = meetingFolder(d.date, d.title);
    entries.push({ path: reserve(`${folder}/summary.md`), bytes: strToU8(summary.markdown) });
    entries.push({ path: reserve(`${folder}/summary.json`), bytes: strToU8(JSON.stringify(summary.json, null, 2)) });
  }

  // 3. Per-deadline text summaries.
  const dls = await c.env.DB.prepare(
    "SELECT id, title, description, category, due_date, status, link FROM deadlines ORDER BY due_date"
  ).all<{ id: string; title: string; description: string | null; category: string | null; due_date: string; status: string | null; link: string | null }>();
  for (const d of dls.results) {
    const dmed = await c.env.DB.prepare(
      "SELECT id, r2_key, caption, kind, content_type FROM media WHERE deadline_id=? ORDER BY uploaded_at"
    )
      .bind(d.id)
      .all<MediaRow>();
    const folder = deadlineFolder(d.title, d.due_date);
    entries.push({ path: reserve(`${folder}/summary.md`), bytes: strToU8(buildDeadlineMarkdown(d, dmed.results)) });
  }

  return streamZip(c.env, entries, "all-media.zip");
});

// Manifest for client-side ZIP: the file list, folders, and inline text
// summaries — but NO media bytes. The browser fetches each file from
// /api/media/:id/file and builds the ZIP locally, streaming it to disk. This
// keeps the Worker's per-request work tiny: the server-side ZIP exceeds the
// Worker CPU limit once the media set grows (measured ~404 MB → 503), because
// reading and CRC-ing every byte is too much compute for one invocation.
export interface ManifestEntry {
  path: string;
  mediaId?: string; // fetch bytes from /api/media/:id/file
  text?: string; // inline content (summaries)
}

exports.get("/manifest", requireUser, async (c) => {
  const used: Record<string, true> = {};
  const reserve = (path: string) => {
    const p = uniquePath(used, path);
    used[p] = true;
    return p;
  };
  const entries: ManifestEntry[] = [];

  // 1. Media — id + folder only, no bytes.
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.r2_key, m.meeting_day_id, m.deadline_id,
            md.date AS day_date, md.title AS day_title,
            dl.title AS dl_title, dl.due_date AS dl_due
     FROM media m
     LEFT JOIN meeting_days md ON md.id = m.meeting_day_id
     LEFT JOIN deadlines dl ON dl.id = m.deadline_id
     ORDER BY md.date, dl.due_date`
  ).all<MediaJoin & { id: string }>();
  for (const m of results) {
    let folder: string;
    if (m.meeting_day_id) folder = meetingFolder(m.day_date, m.day_title);
    else if (m.deadline_id) folder = deadlineFolder(m.dl_title, m.dl_due);
    else folder = "other";
    entries.push({ path: reserve(`${folder}/${cleanFileName(m.r2_key)}`), mediaId: m.id });
  }

  // 2. Per-meeting text summaries. Build them concurrently — done sequentially
  // this is ~16 s of D1 round-trips; entries are still pushed in date order so
  // paths stay stable.
  const days = await c.env.DB.prepare(
    "SELECT id, date, title FROM meeting_days ORDER BY date"
  ).all<{ id: string; date: string; title: string | null }>();
  const daySummaries = await Promise.all(days.results.map((d) => buildDaySummary(c.env, d.id)));
  days.results.forEach((d, i) => {
    const summary = daySummaries[i];
    if (!summary) return;
    const folder = meetingFolder(d.date, d.title);
    entries.push({ path: reserve(`${folder}/summary.md`), text: summary.markdown });
    entries.push({ path: reserve(`${folder}/summary.json`), text: JSON.stringify(summary.json, null, 2) });
  });

  // 3. Per-deadline text summaries (media lists built concurrently, same reason).
  const dls = await c.env.DB.prepare(
    "SELECT id, title, description, category, due_date, status, link FROM deadlines ORDER BY due_date"
  ).all<{ id: string; title: string; description: string | null; category: string | null; due_date: string; status: string | null; link: string | null }>();
  const dlMedia = await Promise.all(
    dls.results.map((d) =>
      c.env.DB.prepare(
        "SELECT id, r2_key, caption, kind, content_type FROM media WHERE deadline_id=? ORDER BY uploaded_at"
      )
        .bind(d.id)
        .all<MediaRow>()
    )
  );
  dls.results.forEach((d, i) => {
    const folder = deadlineFolder(d.title, d.due_date);
    entries.push({ path: reserve(`${folder}/summary.md`), text: buildDeadlineMarkdown(d, dlMedia[i].results) });
  });

  return c.json({ entries });
});
