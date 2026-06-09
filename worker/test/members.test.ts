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
        body: JSON.stringify({ name: "New Kid", committeeIds: ["com-programming", "com-design"] }),
      },
      env as never
    );
    expect(res.status).toBe(201);
    const row = (await res.json()) as { id: string; name: string; active: number; committees: string[] };
    expect(row.name).toBe("New Kid");
    expect(row.active).toBe(1);
    expect([...row.committees].sort()).toEqual(["Design", "Programming"]);
  });

  it("exposes the seeded committee list", async () => {
    const res = await app.request("/api/committees", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ id: string; name: string }>;
    expect(rows.length).toBe(9);
    expect(rows.map((r) => r.name)).toContain("Drivetrain/Collector");
  });

  it("seeds each member's original committee into the join table", async () => {
    const res = await app.request("/api/members", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Array<{ id: string; committees: string[] }>;
    expect(rows.find((r) => r.id === "m-01")?.committees).toEqual(["Outreach"]);
  });

  it("lets the admin rename and replace a member's committees", async () => {
    const res = await app.request(
      "/api/members/m-01",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ name: "Renamed", committeeIds: ["com-design", "com-shooter"] }) },
      env as never
    );
    expect(res.status).toBe(200);
    const row = (await res.json()) as { name: string; committees: string[] };
    expect(row.name).toBe("Renamed");
    expect([...row.committees].sort()).toEqual(["Design", "Shooter"]);

    // Editing the name only must not disturb the committee set.
    const again = await app.request(
      "/api/members/m-01",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ name: "Renamed Twice" }) },
      env as never
    );
    const row2 = (await again.json()) as { committees: string[] };
    expect([...row2.committees].sort()).toEqual(["Design", "Shooter"]);
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
