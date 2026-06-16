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

  it("committees list returns non-empty array with id and name", () => {
    const committees = route("GET", "/api/committees") as Array<{ id: string; name: string }>;
    expect(committees.length).toBeGreaterThan(0);
    expect(committees[0].id).toBeTruthy();
    expect(committees[0].name).toBeTruthy();
  });

  it("members CRUD: list, create, rename", () => {
    const committees = route("GET", "/api/committees") as Array<{ id: string; name: string }>;
    const firstCommitteeId = committees[0].id;
    const firstCommitteeName = committees[0].name;

    const members = route("GET", "/api/members") as Array<{ id: string; name: string; committees: string[] }>;
    expect(members.length).toBeGreaterThan(0);

    const created = route("POST", "/api/members", { name: "Test Person", committeeIds: [firstCommitteeId] }) as { id: string; name: string; committees: string[] };
    expect(created.committees).toContain(firstCommitteeName);

    const renamed = route("PATCH", `/api/members/${created.id}`, { name: "Renamed" }) as { id: string; name: string };
    expect(renamed.name).toBe("Renamed");
  });

  it("templates reorder changes sort order", () => {
    const templates = route("GET", "/api/requirement-templates") as Array<{ id: string; sort_order: number }>;
    expect(templates.length).toBeGreaterThan(0);
    const lastId = templates[templates.length - 1].id;
    const reversedIds = [...templates].map((t) => t.id).reverse();
    route("POST", "/api/requirement-templates/reorder", { ids: reversedIds });
    const after = route("GET", "/api/requirement-templates") as Array<{ id: string; sort_order: number }>;
    expect(after[0].id).toBe(lastId);
  });

  it("add and remove requirement on a meeting day", () => {
    const days = route("GET", "/api/meeting-days") as Array<{ id: string }>;
    const dayId = days[0].id;
    const available = route("GET", `/api/meeting-days/${dayId}/requirements/available`) as Array<{ id: string; label: string }>;
    if (available.length === 0) return; // nothing to add; skip gracefully
    const tpl = available[0];
    const addResult = route("POST", `/api/meeting-days/${dayId}/requirements`, { templateId: tpl.id }) as { requirements: Array<{ id: string; label: string }> };
    expect(addResult.requirements.some((r) => r.label === tpl.label)).toBe(true);

    // now remove it
    const detail = route("GET", `/api/meeting-days/${dayId}`) as { requirements: Array<{ id: string; label: string }> };
    const reqToRemove = detail.requirements.find((r) => r.label === tpl.label)!;
    const deleteResult = route("DELETE", `/api/meeting-days/${dayId}/requirements/${reqToRemove.id}`) as { requirements: Array<{ id: string }> };
    expect(deleteResult.requirements.every((r) => r.id !== reqToRemove.id)).toBe(true);
  });

  it("build-needs open filter returns only unresolved build_need submissions", () => {
    const all = route("GET", "/api/build-needs") as Array<{ resolved: number; kind: string }>;
    const open = route("GET", "/api/build-needs?open=1") as Array<{ resolved: number; kind: string }>;
    expect(open.every((s) => s.resolved === 0 && s.kind === "build_need")).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(open.length);
  });

  it("deadlines mark done sets status and rag to done/green", () => {
    const deadlines = route("GET", "/api/deadlines") as Array<{ id: string; status: string; status_rag: string }>;
    const target = deadlines.find((d) => d.status !== "done") ?? deadlines[0];
    route("POST", `/api/deadlines/${target.id}/done`);
    const after = route("GET", "/api/deadlines") as Array<{ id: string; status: string; status_rag: string }>;
    const updated = after.find((d) => d.id === target.id)!;
    expect(updated.status).toBe("done");
    expect(updated.status_rag).toBe("green");
  });
});
