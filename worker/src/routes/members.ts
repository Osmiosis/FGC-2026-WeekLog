import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser, requireAdmin } from "../auth";

export const members = new Hono<{ Bindings: Env; Variables: Variables }>();

type MemberRow = { id: string; name: string; active: number; committee_names: string | null };

// Shape a joined row into the API member object (committees as a sorted name array).
function shape(row: MemberRow) {
  const { committee_names, ...m } = row;
  return { ...m, committees: committee_names ? committee_names.split("|").sort() : [] };
}

// Replace a member's committee set with the given committee ids.
async function setCommittees(env: Env, memberId: string, committeeIds: string[]) {
  await env.DB.prepare("DELETE FROM member_committees WHERE member_id=?").bind(memberId).run();
  for (const cid of committeeIds) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO member_committees (member_id, committee_id) VALUES (?, ?)"
    )
      .bind(memberId, cid)
      .run();
  }
}

async function loadMember(env: Env, id: string) {
  const row = await env.DB.prepare(
    `SELECT m.id, m.name, m.active, GROUP_CONCAT(c.name, '|') AS committee_names
     FROM members m
     LEFT JOIN member_committees mc ON mc.member_id = m.id
     LEFT JOIN committees c ON c.id = mc.committee_id
     WHERE m.id = ?
     GROUP BY m.id`
  )
    .bind(id)
    .first<MemberRow>();
  return row ? shape(row) : null;
}

// List roster. Any signed-in user can read. ?active=1 hides deactivated members.
members.get("/", requireUser, async (c) => {
  const activeOnly = c.req.query("active") === "1";
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.active, GROUP_CONCAT(c.name, '|') AS committee_names
     FROM members m
     LEFT JOIN member_committees mc ON mc.member_id = m.id
     LEFT JOIN committees c ON c.id = mc.committee_id
     ${activeOnly ? "WHERE m.active = 1" : ""}
     GROUP BY m.id
     ORDER BY m.name`
  ).all<MemberRow>();
  return c.json(results.map(shape));
});

members.post("/", requireAdmin, async (c) => {
  const body = await c.req.json<{ name?: string; committeeIds?: string[] }>();
  if (!body.name) return c.json({ error: "name required" }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO members (id, name, active) VALUES (?, ?, 1)")
    .bind(id, body.name)
    .run();
  if (body.committeeIds?.length) await setCommittees(c.env, id, body.committeeIds);
  return c.json(await loadMember(c.env, id), 201);
});

members.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; committeeIds?: string[]; active?: number }>();
  const existing = await c.env.DB.prepare("SELECT name, active FROM members WHERE id=?")
    .bind(id)
    .first<{ name: string; active: number }>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const name = body.name ?? existing.name;
  const active = body.active ?? existing.active;
  await c.env.DB.prepare("UPDATE members SET name=?, active=? WHERE id=?")
    .bind(name, active, id)
    .run();
  if (body.committeeIds) await setCommittees(c.env, id, body.committeeIds);
  return c.json(await loadMember(c.env, id));
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
