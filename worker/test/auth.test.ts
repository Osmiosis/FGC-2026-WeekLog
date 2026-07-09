import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();

// Mock better-auth at the import boundary so createAuth() returns a stub whose
// api.getSession we control. (Mocking ../src/auth's createAuth does NOT work:
// requireUser calls createAuth via a local reference the mock can't intercept.)
vi.mock("better-auth", () => ({
  betterAuth: () => ({ api: { getSession }, handler: async () => new Response(null) }),
}));
vi.mock("better-auth/plugins", () => ({ bearer: () => ({}) }));
vi.mock("kysely-d1", () => ({ D1Dialect: class {} }));

import app from "../src/index";
import type { Env } from "../src/bindings";

const baseEnv = {
  ADMIN_EMAIL: "admin@example.com",
  BETTER_AUTH_URL: "https://w.example.com",
  BETTER_AUTH_SECRET: "x".repeat(32),
  GOOGLE_CLIENT_ID: "gid",
  GOOGLE_CLIENT_SECRET: "gsecret",
} as unknown as Env;

beforeEach(() => getSession.mockReset());

describe("auth + /api/me", () => {
  it("anonymous (no session) -> email empty, not admin", async () => {
    getSession.mockResolvedValue(null);
    const res = await app.request("/api/me", {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "", isAdmin: false });
  });

  it("DEMO_ALL_ADMIN makes any signed-in user admin", async () => {
    getSession.mockResolvedValue({ user: { id: "1", email: "kid@example.com" } });
    const env = { ...baseEnv, DEMO_ALL_ADMIN: "true" };
    const res = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, env);
    expect(await res.json()).toEqual({ email: "kid@example.com", isAdmin: true });
  });

  it("without DEMO flag, only ADMIN_EMAIL is admin", async () => {
    getSession.mockResolvedValue({ user: { id: "1", email: "kid@example.com" } });
    const res = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, baseEnv);
    expect(await res.json()).toEqual({ email: "kid@example.com", isAdmin: false });

    getSession.mockResolvedValue({ user: { id: "2", email: "admin@example.com" } });
    const res2 = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, baseEnv);
    expect(await res2.json()).toEqual({ email: "admin@example.com", isAdmin: true });
  });

  it("requests from DEMO_ORIGIN make any signed-in user admin; other origins do not", async () => {
    getSession.mockResolvedValue({ user: { id: "1", email: "kid@example.com" } });
    const env = { ...baseEnv, DEMO_ORIGIN: "https://demo.example.com" } as unknown as Env;

    // From the demo origin: non-admin email becomes admin.
    const demo = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer t", Origin: "https://demo.example.com" } },
      env
    );
    expect(await demo.json()).toEqual({ email: "kid@example.com", isAdmin: true });

    // From the main origin: same user is only a member.
    const main = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer t", Origin: "https://main.example.com" } },
      env
    );
    expect(await main.json()).toEqual({ email: "kid@example.com", isAdmin: false });
  });
});
