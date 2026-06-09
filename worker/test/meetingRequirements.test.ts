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
});
