import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

type Tpl = {
  id: string;
  label: string;
  compulsory: number;
  active: number;
  sort_order: number;
};

describe("requirement templates CRUD", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    env = testEnv(makeTestDb());
  });

  it("lists the 9 seeded templates in sort order", async () => {
    const res = await app.request(
      "/api/requirement-templates",
      { headers: MEMBER },
      env as never
    );
    const rows = (await res.json()) as Tpl[];
    expect(rows.length).toBe(9);
    expect(rows[0].label).toBe("Attendance records");
  });

  it("forbids a member from mutating", async () => {
    const res = await app.request(
      "/api/requirement-templates",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ label: "X" }) },
      env as never
    );
    expect(res.status).toBe(403);
  });

  it("lets the admin add a template at the end", async () => {
    const res = await app.request(
      "/api/requirement-templates",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ label: "Sponsor logo check", expected_kind: "media", compulsory: 0 }),
      },
      env as never
    );
    expect(res.status).toBe(201);
    const row = (await res.json()) as Tpl;
    expect(row.sort_order).toBe(10);
    expect(row.compulsory).toBe(0);
  });

  it("toggles compulsory via PATCH", async () => {
    const res = await app.request(
      "/api/requirement-templates/tpl-failure-log",
      { method: "PATCH", headers: ADMIN, body: JSON.stringify({ compulsory: 1 }) },
      env as never
    );
    const row = (await res.json()) as Tpl;
    expect(row.compulsory).toBe(1);
  });

  it("soft-deactivates via DELETE", async () => {
    const res = await app.request(
      "/api/requirement-templates/tpl-cad-file",
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect((await res.json()) as unknown).toEqual({ ok: true, deleted: "soft" });
    const list = await app.request(
      "/api/requirement-templates?active=1",
      { headers: ADMIN },
      env as never
    );
    const active = (await list.json()) as Tpl[];
    expect(active.find((t) => t.id === "tpl-cad-file")).toBeUndefined();
  });

  it("reorders by an ordered id array", async () => {
    const ids = [
      "tpl-build-needs",
      "tpl-attendance",
      "tpl-accomplishments",
      "tpl-perf-goals",
      "tpl-photos-meeting",
      "tpl-photos-sketches",
      "tpl-failure-log",
      "tpl-cad-file",
      "tpl-strategy-note",
    ];
    const res = await app.request(
      "/api/requirement-templates/reorder",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ ids }) },
      env as never
    );
    expect(res.status).toBe(200);
    const list = await app.request(
      "/api/requirement-templates",
      { headers: ADMIN },
      env as never
    );
    const rows = (await list.json()) as Tpl[];
    expect(rows[0].id).toBe("tpl-build-needs");
    expect(rows[0].sort_order).toBe(1);
  });
});
