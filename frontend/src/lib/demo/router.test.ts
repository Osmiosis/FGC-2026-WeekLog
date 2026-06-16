// frontend/src/lib/demo/router.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { route } from "./router";

beforeEach(() => localStorage.clear());

describe("router", () => {
  it("GET /api/me reports admin", () => {
    expect(route("GET", "/api/me")).toEqual({ email: "demo@demo.app", isAdmin: true });
  });

  it("GET /api/drive/status is not configured", () => {
    expect(route("GET", "/api/drive/status")).toEqual({ configured: false });
  });

  it("lists meeting days with a derived status", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string; status: string }>;
    expect(days.length).toBeGreaterThan(0);
    expect(["green", "amber", "red"]).toContain(days[0].status);
  });

  it("attendance returns members by name and toggles present", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string }>;
    const id = days[0].id;
    const att = route("GET", `/api/meeting-days/${id}/attendance`) as Array<{ member_id: string; name: string; present: number }>;
    expect(att[0].name).toBeTruthy();
    const target = att.find((a) => a.present === 0) ?? att[0];
    route("POST", `/api/meeting-days/${id}/attendance`, { member_id: target.member_id, present: 1 });
    const att2 = route("GET", `/api/meeting-days/${id}/attendance`) as Array<{ member_id: string; present: number }>;
    expect(att2.find((a) => a.member_id === target.member_id)!.present).toBe(1);
  });

  it("adds a text submission and flips the requirement to submitted", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string }>;
    const id = days[1].id;
    const before = route("GET", `/api/meeting-days/${id}`) as { requirements: Array<{ id: string; expected_kind: string | null; status: string }> };
    const textReq = before.requirements.find((r) => r.expected_kind === "text")!;
    route("POST", `/api/meeting-days/${id}/submissions`, { kind: "accomplishment", content: "hi", requirement_id: textReq.id });
    const after = route("GET", `/api/meeting-days/${id}`) as { requirements: Array<{ id: string; status: string }> };
    expect(after.requirements.find((r) => r.id === textReq.id)!.status).toBe("submitted");
  });

  it("search filters submissions by query", () => {
    const res = route("GET", "/api/search?q=flywheel") as Array<{ content: string }>;
    expect(res.every((r) => (r.content ?? "").toLowerCase().includes("flywheel"))).toBe(true);
    expect(res.length).toBeGreaterThan(0);
  });

  it("dashboard returns overall RAG and counts", () => {
    const dash = route("GET", "/api/dashboard") as { overall: string; counts: { daysFlagged: number } };
    expect(["green", "amber", "red"]).toContain(dash.overall);
    expect(typeof dash.counts.daysFlagged).toBe("number");
  });

  it("throws on an unknown route", () => {
    expect(() => route("GET", "/api/nope")).toThrow();
  });
});
