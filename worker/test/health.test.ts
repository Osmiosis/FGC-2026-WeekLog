import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("GET /api/health", () => {
  it("returns ok with a service name", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "weeklog-worker" });
  });
});
