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
});
