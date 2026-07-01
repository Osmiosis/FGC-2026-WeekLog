import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

describe("notebook prep", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("starts with no reports", async () => {
    const res = await app.request("/api/notebook/reports", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("lets a member queue a refresh request the admin can see", async () => {
    const post = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "timeline" }) },
      env as never
    );
    expect(post.status).toBe(200);

    const list = await app.request("/api/notebook/requests", { headers: ADMIN }, env as never);
    const summary = (await list.json()) as { kind: string; count: number; latest_requested_at: string }[];
    expect(summary).toEqual([{ kind: "timeline", count: 1, latest_requested_at: expect.any(String) }]);
  });

  it("rejects an unknown request kind", async () => {
    const res = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "bogus" }) },
      env as never
    );
    expect(res.status).toBe(400);
  });
});
