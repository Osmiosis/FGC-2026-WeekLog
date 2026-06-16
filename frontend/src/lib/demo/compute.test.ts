// frontend/src/lib/demo/compute.test.ts
import { describe, it, expect } from "vitest";
import { dayRag, deadlineRag, deriveRequirementStatus, deriveDay, dayStatusFromDerived } from "./compute";
import type { DemoDB } from "./types";

describe("dayRag", () => {
  it("green when no compulsory items", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 0, compulsorySatisfied: 0 })).toBe("green");
  });
  it("green when all compulsory satisfied", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 2 })).toBe("green");
  });
  it("red when past and incomplete", () => {
    expect(dayRag({ date: "2026-01-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 1 })).toBe("red");
  });
  it("amber when today/future and incomplete", () => {
    expect(dayRag({ date: "2026-02-01", today: "2026-02-01", compulsoryTotal: 2, compulsorySatisfied: 1 })).toBe("amber");
  });
});

describe("deadlineRag", () => {
  it("green when done", () => {
    expect(deadlineRag({ status: "done", due_date: "2026-01-01", today: "2026-02-01" })).toBe("green");
  });
  it("red when open and overdue", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-01-01", today: "2026-02-01" })).toBe("red");
  });
  it("amber when due within 7 days", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-02-05", today: "2026-02-01" })).toBe("amber");
  });
  it("green when open and far out", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-03-01", today: "2026-02-01" })).toBe("green");
  });
});

describe("deriveDay + dayStatusFromDerived", () => {
  const db: DemoDB = {
    committees: [], members: [], member_committees: [], templates: [],
    meeting_days: [{ id: "d1", date: "2026-01-10", title: null }],
    meeting_requirements: [
      { id: "r-att", meeting_day_id: "d1", template_id: null, label: "Attendance", compulsory: 1, expected_kind: "attendance", status: "missing", active: 1, custom: 0 },
      { id: "r-txt", meeting_day_id: "d1", template_id: null, label: "Accomplishments", compulsory: 1, expected_kind: "text", status: "missing", active: 1, custom: 0 },
    ],
    attendance: [{ id: "a1", meeting_day_id: "d1", member_id: "m1", present: 1 }],
    submissions: [], media: [], deadlines: [],
  };

  it("attendance satisfied by a present member, text still missing", () => {
    const derived = deriveDay(db, "d1");
    expect(derived.requirements.find((r) => r.id === "r-att")!.status).toBe("submitted");
    expect(derived.requirements.find((r) => r.id === "r-txt")!.status).toBe("missing");
    expect(derived.missingCompulsory.map((r) => r.id)).toEqual(["r-txt"]);
    expect(dayStatusFromDerived("2026-01-10", "2026-02-01", derived)).toBe("red");
  });

  it("text satisfied by an unassigned text-kind submission", () => {
    const db2: DemoDB = { ...db, submissions: [{ id: "s1", meeting_day_id: "d1", requirement_id: null, kind: "accomplishment", subsystem: null, content: "did x", created_by: "a@b.c", created_at: "2026-01-10T00:00:00Z", resolved: 0 }] };
    const derived = deriveDay(db2, "d1");
    expect(derived.missingCompulsory).toHaveLength(0);
    expect(dayStatusFromDerived("2026-01-10", "2026-02-01", derived)).toBe("green");
  });
});
