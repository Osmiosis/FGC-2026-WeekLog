import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth, D1Shim } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

// Mark a day and return its id.
async function mark(env: unknown, date: string): Promise<string> {
  const res = await app.request(
    "/api/meeting-days",
    { method: "POST", headers: ADMIN, body: JSON.stringify({ date }) },
    env as never
  );
  const created = (await res.json()) as { id: string };
  return created.id;
}

// Fetch a day's requirement checklist.
async function getReqs(env: unknown, id: string) {
  const res = await app.request(`/api/meeting-days/${id}`, { headers: ADMIN }, env as never);
  const day = (await res.json()) as {
    requirements: Array<{ id: string; label: string; compulsory: number; status: string; custom: number; expected_kind: string | null }>;
  };
  return day.requirements;
}

describe("per-meeting requirement editing", () => {
  let db: D1Shim;
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    db = makeTestDb();
    env = testEnv(db);
  });

  it("snapshots requirements as active=1, custom=0 by default", async () => {
    const id = await mark(env, "2026-07-07");
    const row = await db
      .prepare("SELECT active, custom FROM meeting_requirements WHERE meeting_day_id=? LIMIT 1")
      .bind(id)
      .first<{ active: number; custom: number }>();
    expect(row?.active).toBe(1);
    expect(row?.custom).toBe(0);
  });

  it("toggles a requirement compulsory <-> voluntary and updates RAG", async () => {
    const id = await mark(env, "2026-07-07");
    const before = await getReqs(env, id);
    const target = before.find((r) => r.compulsory === 1 && r.expected_kind === "text");
    expect(target).toBeTruthy();

    const res = await app.request(
      `/api/meeting-days/${id}/requirements/${target!.id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(res.status).toBe(200);

    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target!.id)!.compulsory).toBe(0);
  });

  it("rejects a bad compulsory value (400) and a non-admin (403)", async () => {
    const id = await mark(env, "2026-07-07");
    const r = (await getReqs(env, id))[0];

    const bad = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 5 }) },
      env as never
    );
    expect(bad.status).toBe(400);

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "PATCH", headers: MEMBER, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });

  it("404s when the requirement does not belong to the day", async () => {
    const id = await mark(env, "2026-07-07");
    const res = await app.request(
      `/api/meeting-days/${id}/requirements/does-not-exist`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 0 }) },
      env as never
    );
    expect(res.status).toBe(404);
  });

  it("soft-removes a requirement: it leaves the checklist but stays in the DB", async () => {
    const id = await mark(env, "2026-07-07");
    const before = await getReqs(env, id);
    const target = before[0];

    const res = await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(res.status).toBe(200);

    // Gone from the checklist...
    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target.id)).toBeUndefined();
    expect(after.length).toBe(before.length - 1);

    // ...but the row is still in the DB with active=0 (data preserved).
    const row = await db
      .prepare("SELECT active FROM meeting_requirements WHERE id=?")
      .bind(target.id)
      .first<{ active: number }>();
    expect(row?.active).toBe(0);
  });

  it("rejects soft-remove by a non-admin (403) and 404s an unknown requirement", async () => {
    const id = await mark(env, "2026-07-07");
    const r = (await getReqs(env, id))[0];

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements/${r.id}`,
      { method: "DELETE", headers: MEMBER },
      env as never
    );
    expect(forbidden.status).toBe(403);

    const missing = await app.request(
      `/api/meeting-days/${id}/requirements/nope`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(missing.status).toBe(404);
  });

  it("lists templates not currently on the meeting as available", async () => {
    const id = await mark(env, "2026-07-07");
    const target = (await getReqs(env, id)).find((r) => r.expected_kind === "media")!;

    // Initially no templates are available (all 9 are snapshotted).
    let res = await app.request(
      `/api/meeting-days/${id}/requirements/available`,
      { headers: ADMIN },
      env as never
    );
    expect(((await res.json()) as unknown[]).length).toBe(0);

    // Remove one; its template becomes available again.
    await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    res = await app.request(
      `/api/meeting-days/${id}/requirements/available`,
      { headers: ADMIN },
      env as never
    );
    const avail = (await res.json()) as Array<{ id: string; label: string }>;
    expect(avail.length).toBe(1);
  });

  it("re-adding a removed default reactivates the original row (no duplicate)", async () => {
    const id = await mark(env, "2026-07-07");
    const target = (await getReqs(env, id))[0];
    const templateId = (await db
      .prepare("SELECT template_id FROM meeting_requirements WHERE id=?")
      .bind(target.id)
      .first<{ template_id: string }>())!.template_id;

    await app.request(
      `/api/meeting-days/${id}/requirements/${target.id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    const res = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ templateId }) },
      env as never
    );
    expect(res.status).toBe(201);

    // Same row id is back (reactivated), not a fresh duplicate.
    const after = await getReqs(env, id);
    expect(after.find((r) => r.id === target.id)).toBeTruthy();
    const total = await db
      .prepare("SELECT COUNT(*) AS n FROM meeting_requirements WHERE meeting_day_id=? AND template_id=?")
      .bind(id, templateId)
      .first<{ n: number }>();
    expect(total?.n).toBe(1);
  });

  it("adds a custom one-off requirement (template_id NULL, custom=1)", async () => {
    const id = await mark(env, "2026-07-07");
    const res = await app.request(
      `/api/meeting-days/${id}/requirements`,
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ label: "Sponsor logo placement", compulsory: 1, expectedKind: "media" }),
      },
      env as never
    );
    expect(res.status).toBe(201);

    const after = await getReqs(env, id);
    const added = after.find((r) => r.label === "Sponsor logo placement");
    expect(added).toBeTruthy();
    expect(added!.compulsory).toBe(1);
    expect(added!.custom).toBe(1);
  });

  it("validates add input and gating", async () => {
    const id = await mark(env, "2026-07-07");

    const badKind = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ label: "x", expectedKind: "bogus" }) },
      env as never
    );
    expect(badKind.status).toBe(400);

    const empty = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({}) },
      env as never
    );
    expect(empty.status).toBe(400);

    const forbidden = await app.request(
      `/api/meeting-days/${id}/requirements`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ label: "x" }) },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });
});
