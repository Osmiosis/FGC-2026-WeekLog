import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

describe("members CRUD", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("lists the seeded roster for any signed-in user", async () => {
    const res = await app.request("/api/members", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(rows.length).toBe(21);
  });

  it("forbids a member from creating", async () => {
    const res = await app.request(
      "/api/members",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ name: "X" }) },
      env as never
    );
    expect(res.status).toBe(403);
  });

  it("lets the admin create a member", async () => {
    const res = await app.request(
      "/api/members",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ name: "New Kid", committee: "Programming" }),
      },
      env as never
    );
    expect(res.status).toBe(201);
    const row = (await res.json()) as { id: string; name: string; active: number };
    expect(row.name).toBe("New Kid");
    expect(row.active).toBe(1);
  });

  it("lets the admin edit a member", async () => {
    const res = await app.request(
      "/api/members/m-01",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ name: "Renamed" }) },
      env as never
    );
    expect(res.status).toBe(200);
    const row = (await res.json()) as { name: string };
    expect(row.name).toBe("Renamed");
  });

  it("soft-deactivates by default and hard-deletes with ?hard=true", async () => {
    const soft = await app.request(
      "/api/members/m-02",
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect((await soft.json()) as unknown).toEqual({ ok: true, deleted: "soft" });

    const list = await app.request(
      "/api/members?active=1",
      { headers: ADMIN },
      env as never
    );
    const active = (await list.json()) as Array<{ id: string }>;
    expect(active.find((m) => m.id === "m-02")).toBeUndefined();

    const hard = await app.request(
      "/api/members/m-03?hard=true",
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect((await hard.json()) as unknown).toEqual({ ok: true, deleted: "hard" });

    const all = await app.request("/api/members", { headers: ADMIN }, env as never);
    const rows = (await all.json()) as Array<{ id: string }>;
    expect(rows.find((m) => m.id === "m-03")).toBeUndefined();
  });
});
