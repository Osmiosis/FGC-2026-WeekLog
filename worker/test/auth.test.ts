import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

describe("auth + /api/me", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("rejects requests with no token", async () => {
    const res = await app.request("/api/me", {}, env as never);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer garbage" } },
      env as never
    );
    expect(res.status).toBe(401);
  });

  it("identifies the admin", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer admin-token" } },
      env as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      email: "vibha.aarav@gmail.com",
      isAdmin: true,
    });
  });

  it("identifies a member as non-admin", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer member-token" } },
      env as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "kid@example.com", isAdmin: false });
  });
});
