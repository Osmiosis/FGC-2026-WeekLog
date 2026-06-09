import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth, D1Shim } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

async function mark(env: unknown, date: string) {
  return app.request(
    "/api/meeting-days",
    { method: "POST", headers: ADMIN, body: JSON.stringify({ date }) },
    env as never
  );
}

describe("meeting days + snapshot", () => {
  let db: D1Shim;
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    db = makeTestDb();
    env = testEnv(db);
  });

  it("marks a day and snapshots all 9 active templates as missing", async () => {
    const res = await mark(env, "2026-07-07");
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; requirementCount: number };
    expect(created.requirementCount).toBe(9);

    const detail = await app.request(
      `/api/meeting-days/${created.id}`,
      { headers: MEMBER },
      env as never
    );
    const day = (await detail.json()) as {
      requirements: Array<{ status: string }>;
    };
    expect(day.requirements.length).toBe(9);
    expect(day.requirements.every((r) => r.status === "missing")).toBe(true);
  });

  it("rejects re-marking the same date with 409", async () => {
    await mark(env, "2026-07-07");
    const again = await mark(env, "2026-07-07");
    expect(again.status).toBe(409);
  });

  it("forbids a member from marking", async () => {
    const res = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ date: "2026-07-08" }) },
      env as never
    );
    expect(res.status).toBe(403);
  });

  it("freezes the snapshot against later template changes", async () => {
    const res = await mark(env, "2026-07-07");
    const { id } = (await res.json()) as { id: string };
    // Deactivate a template AFTER the day was marked.
    await app.request(
      "/api/requirement-templates/tpl-cad-file",
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    const detail = await app.request(
      `/api/meeting-days/${id}`,
      { headers: ADMIN },
      env as never
    );
    const day = (await detail.json()) as { requirements: unknown[] };
    expect(day.requirements.length).toBe(9); // unchanged
  });

  it("unmarks a day and removes its requirements", async () => {
    const res = await mark(env, "2026-07-07");
    const { id } = (await res.json()) as { id: string };
    const del = await app.request(
      `/api/meeting-days/${id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(del.status).toBe(200);
    const detail = await app.request(
      `/api/meeting-days/${id}`,
      { headers: ADMIN },
      env as never
    );
    expect(detail.status).toBe(404);
  });

  it("unmarks a day that has attendance, submissions, and media", async () => {
    const res = await mark(env, "2026-07-07");
    const { id } = (await res.json()) as { id: string };

    await app.request(
      `/api/meeting-days/${id}/attendance`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ member_id: "m-01", present: 1 }) },
      env as never
    );
    await app.request(
      `/api/meeting-days/${id}/submissions`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ kind: "note", content: "x" }) },
      env as never
    );
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2])], "a.png", { type: "image/png" }));
    await app.request(
      `/api/meeting-days/${id}/media`,
      { method: "POST", headers: ADMIN, body: form },
      env as never
    );

    const del = await app.request(
      `/api/meeting-days/${id}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(del.status).toBe(200);

    const detail = await app.request(`/api/meeting-days/${id}`, { headers: ADMIN }, env as never);
    expect(detail.status).toBe(404);
  });

  it("bulk-marks every Tuesday and Thursday in July 2026", async () => {
    // July 2026: Tuesdays 7,14,21,28; Thursdays 2,9,16,23,30 -> 9 days.
    const res = await app.request(
      "/api/meeting-days/bulk",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ start: "2026-07-01", end: "2026-07-31", weekdays: [2, 4] }),
      },
      env as never
    );
    expect(res.status).toBe(200);
    const out = (await res.json()) as { created: number; skipped: number };
    expect(out.created).toBe(9);
    expect(out.skipped).toBe(0);

    // Re-running skips them all.
    const again = await app.request(
      "/api/meeting-days/bulk",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ start: "2026-07-01", end: "2026-07-31", weekdays: [2, 4] }),
      },
      env as never
    );
    const out2 = (await again.json()) as { created: number; skipped: number };
    expect(out2.created).toBe(0);
    expect(out2.skipped).toBe(9);
  });

  it("rejects bulk with empty weekdays (400) and member (403)", async () => {
    const bad = await app.request(
      "/api/meeting-days/bulk",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ start: "2026-07-01", end: "2026-07-31", weekdays: [] }),
      },
      env as never
    );
    expect(bad.status).toBe(400);

    const forbidden = await app.request(
      "/api/meeting-days/bulk",
      {
        method: "POST",
        headers: MEMBER,
        body: JSON.stringify({ start: "2026-07-01", end: "2026-07-31", weekdays: [2] }),
      },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });

  it("renames a meeting day and clears the title with an empty string", async () => {
    const res = await mark(env, "2026-07-07");
    const { id } = (await res.json()) as { id: string };

    const patch = await app.request(
      `/api/meeting-days/${id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ title: "  Kickoff sprint  " }) },
      env as never
    );
    expect(patch.status).toBe(200);

    let detail = await app.request(`/api/meeting-days/${id}`, { headers: MEMBER }, env as never);
    expect(((await detail.json()) as { title: string | null }).title).toBe("Kickoff sprint");

    // Empty/whitespace title clears back to null.
    const clear = await app.request(
      `/api/meeting-days/${id}`,
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ title: "   " }) },
      env as never
    );
    expect(clear.status).toBe(200);
    detail = await app.request(`/api/meeting-days/${id}`, { headers: MEMBER }, env as never);
    expect(((await detail.json()) as { title: string | null }).title).toBeNull();
  });

  it("rejects rename of an unknown day (404) and from a member (403)", async () => {
    const res = await mark(env, "2026-07-07");
    const { id } = (await res.json()) as { id: string };

    const missing = await app.request(
      "/api/meeting-days/nope",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ title: "x" }) },
      env as never
    );
    expect(missing.status).toBe(404);

    const forbidden = await app.request(
      `/api/meeting-days/${id}`,
      { method: "PATCH", headers: MEMBER, body: JSON.stringify({ title: "x" }) },
      env as never
    );
    expect(forbidden.status).toBe(403);
  });
});
