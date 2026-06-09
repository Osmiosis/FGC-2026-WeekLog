import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client so api() has a token to attach.
vi.mock("./supabase", () => ({
  isConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "tok123", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      }),
      refreshSession: async () => ({ data: { session: { access_token: "tok123" } } }),
    },
  },
}));

import { api } from "./api";

describe("api() wiring contract", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("attaches the bearer token and targets the given path", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api("/api/health");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/health");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok123");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(api("/api/x")).rejects.toThrow();
  });
});
