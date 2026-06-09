import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { addDaysUTC } from "../src/compliance";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("deadlines", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("lists the seeded deadline with a derived status", async () => {
    const res = await app.request("/api/deadlines", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Array<{ title: string; status_rag: string }>;
    const seeded = rows.find((r) => r.title.startsWith("SM Challenge #1"))!;
    expect(["green", "amber", "red"]).toContain(seeded.status_rag);
  });

  it("derives overdue->red, soon->amber, far->green", async () => {
    const make = async (due: string) =>
      app.request(
        "/api/deadlines",
        { method: "POST", headers: ADMIN, body: JSON.stringify({ title: `d ${due}`, due_date: due }) },
        env as never
      );
    await make(addDaysUTC(todayUTC(), -3)); // overdue
    await make(addDaysUTC(todayUTC(), 3)); // soon
    await make(addDaysUTC(todayUTC(), 30)); // far

    const res = await app.request("/api/deadlines", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Array<{ title: string; status_rag: string }>;
    const byTitle = (t: string) => rows.find((r) => r.title === t)!.status_rag;
    expect(byTitle(`d ${addDaysUTC(todayUTC(), -3)}`)).toBe("red");
    expect(byTitle(`d ${addDaysUTC(todayUTC(), 3)}`)).toBe("amber");
    expect(byTitle(`d ${addDaysUTC(todayUTC(), 30)}`)).toBe("green");
  });

  it("forbids a member from creating but lets a member mark done", async () => {
    const forbidden = await app.request(
      "/api/deadlines",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ title: "x", due_date: "2026-09-01" }) },
      env as never
    );
    expect(forbidden.status).toBe(403);

    const done = await app.request(
      "/api/deadlines/dl-sm-1/done",
      { method: "POST", headers: MEMBER },
      env as never
    );
    expect(done.status).toBe(200);
    const row = (await done.json()) as { status: string; completed_at: string | null };
    expect(row.status).toBe("done");
    expect(row.completed_at).not.toBeNull();
  });

  it("admin can edit and delete", async () => {
    const patch = await app.request(
      "/api/deadlines/dl-sm-1",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ title: "Renamed challenge" }) },
      env as never
    );
    expect(((await patch.json()) as { title: string }).title).toBe("Renamed challenge");

    const del = await app.request(
      "/api/deadlines/dl-sm-1",
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(del.status).toBe(200);
    const list = await app.request("/api/deadlines", { headers: ADMIN }, env as never);
    expect(((await list.json()) as unknown[]).length).toBe(0);
  });

  it("a member uploads proof media tied to the deadline", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([7, 7])], "proof.png", { type: "image/png" }));
    form.set("kind", "photo");
    const up = await app.request(
      "/api/deadlines/dl-sm-1/media",
      { method: "POST", headers: MEMBER, body: form },
      env as never
    );
    expect(up.status).toBe(201);
    const row = (await up.json()) as { id: string; deadline_id: string };
    expect(row.deadline_id).toBe("dl-sm-1");

    const list = await app.request(
      "/api/deadlines/dl-sm-1/media",
      { headers: MEMBER },
      env as never
    );
    expect(((await list.json()) as unknown[]).length).toBe(1);

    const file = await app.request(`/api/media/${row.id}/file`, { headers: MEMBER }, env as never);
    expect(file.status).toBe(200);
  });
});
