import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

type Sub = { id: string; kind: string; subsystem: string | null; content: string | null };

describe("search + build needs", () => {
  let env: Record<string, unknown>;

  beforeEach(async () => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
    // Mark a day and add two submissions to search over.
    const mk = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ date: "2026-07-07" }) },
      env as never
    );
    const dayId = ((await mk.json()) as { id: string }).id;
    await app.request(
      `/api/meeting-days/${dayId}/submissions`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "accomplishment", content: "Drivetrain works", subsystem: "Drivetrain/Collector" }) },
      env as never
    );
    await app.request(
      `/api/meeting-days/${dayId}/submissions`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "build_need", content: "Need bolts", subsystem: "Shooter" }) },
      env as never
    );
  });

  it("searches submission content", async () => {
    const res = await app.request("/api/search?q=bolts", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Sub[];
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe("build_need");
  });

  it("filters by subsystem", async () => {
    const res = await app.request("/api/search?subsystem=Shooter", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Sub[];
    expect(rows.every((r) => r.subsystem === "Shooter")).toBe(true);
    expect(rows.length).toBe(1);
  });

  it("filters by kind", async () => {
    const res = await app.request("/api/search?kind=accomplishment", { headers: MEMBER }, env as never);
    const rows = (await res.json()) as Sub[];
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe("Drivetrain works");
  });

  it("filters by date range", async () => {
    const inRange = await app.request(
      "/api/search?from=2026-07-01&to=2026-07-31",
      { headers: MEMBER },
      env as never
    );
    expect(((await inRange.json()) as Sub[]).length).toBe(2);
    const outRange = await app.request(
      "/api/search?from=2026-08-01&to=2026-08-31",
      { headers: MEMBER },
      env as never
    );
    expect(((await outRange.json()) as Sub[]).length).toBe(0);
  });

  it("aggregates open build needs and resolves them", async () => {
    const open = await app.request("/api/build-needs?open=1", { headers: MEMBER }, env as never);
    const rows = (await open.json()) as Sub[];
    expect(rows.length).toBe(1);
    const needId = rows[0].id;

    const resolve = await app.request(
      `/api/submissions/${needId}/resolve`,
      { method: "POST", headers: MEMBER },
      env as never
    );
    expect(resolve.status).toBe(200);

    const openAfter = await app.request("/api/build-needs?open=1", { headers: MEMBER }, env as never);
    expect(((await openAfter.json()) as Sub[]).length).toBe(0);

    const all = await app.request("/api/build-needs", { headers: MEMBER }, env as never);
    expect(((await all.json()) as Sub[]).length).toBe(1);
  });
});
