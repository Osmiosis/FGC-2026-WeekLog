import { describe, it, expect } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv } from "./helpers/d1";

describe("CORS", () => {
  it("sets Access-Control-Allow-Origin on API responses", async () => {
    const env = testEnv(makeTestDb());
    const res = await app.request(
      "/api/health",
      { headers: { Origin: "https://weeklog.pages.dev" } },
      env as never
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("answers preflight OPTIONS for an authed route", async () => {
    const env = testEnv(makeTestDb());
    const res = await app.request(
      "/api/members",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://weeklog.pages.dev",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      },
      env as never
    );
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
