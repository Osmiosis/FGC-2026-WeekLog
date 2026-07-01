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
});
