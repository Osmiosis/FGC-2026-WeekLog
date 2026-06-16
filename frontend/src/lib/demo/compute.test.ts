// frontend/src/lib/demo/compute.test.ts
import { describe, it, expect } from "vitest";
import { dayRag, deadlineRag, deriveRequirementStatus, deriveDay, dayStatusFromDerived, committeesOf } from "./compute";
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

describe("committeesOf", () => {
  const db: DemoDB = {
    committees: [
      { id: "c2", name: "Zeta", sort_order: 2 },
      { id: "c1", name: "Alpha", sort_order: 1 },
    ],
    members: [{ id: "m1", name: "Alice", active: 1 }],
    member_committees: [
      { member_id: "m1", committee_id: "c2" },
      { member_id: "m1", committee_id: "c1" },
    ],
    templates: [], meeting_days: [], meeting_requirements: [],
    attendance: [], submissions: [], media: [], deadlines: [],
  };

  it("returns committee names sorted alphabetically for a member with two committees", () => {
    expect(committeesOf(db, "m1")).toEqual(["Alpha", "Zeta"]);
  });

  it("returns [] for a member with no committees", () => {
    expect(committeesOf(db, "m2")).toEqual([]);
  });
});

describe("deriveDay excludes inactive requirements", () => {
  const db: DemoDB = {
    committees: [], members: [], member_committees: [], templates: [],
    meeting_days: [{ id: "d1", date: "2026-02-10", title: null }],
    meeting_requirements: [
      { id: "r-active", meeting_day_id: "d1", template_id: null, label: "Active Req", compulsory: 1, expected_kind: "text", status: "missing", active: 1, custom: 0 },
      { id: "r-inactive", meeting_day_id: "d1", template_id: null, label: "Inactive Req", compulsory: 1, expected_kind: "text", status: "missing", active: 0, custom: 0 },
    ],
    attendance: [], submissions: [], media: [], deadlines: [],
  };

  it("only includes active requirements; inactive are excluded", () => {
    const derived = deriveDay(db, "d1");
    expect(derived.requirements).toHaveLength(1);
    expect(derived.requirements[0].id).toBe("r-active");
  });
});

describe("media fallback branch", () => {
  const db: DemoDB = {
    committees: [], members: [], member_committees: [], templates: [],
    meeting_days: [{ id: "d1", date: "2026-02-10", title: null }],
    meeting_requirements: [
      { id: "r-media", meeting_day_id: "d1", template_id: null, label: "Media Upload", compulsory: 1, expected_kind: "media", status: "missing", active: 1, custom: 0 },
    ],
    attendance: [],
    submissions: [],
    media: [{ id: "media1", meeting_day_id: "d1", deadline_id: null, requirement_id: null, subsystem: null, caption: null, kind: "photo", content_type: "image/jpeg", uploaded_by: null, uploaded_at: "2026-02-10T12:00:00Z" }],
    deadlines: [],
  };

  it("unassigned media row satisfies a media requirement (fallback)", () => {
    const derived = deriveDay(db, "d1");
    expect(derived.requirements.find((r) => r.id === "r-media")!.status).toBe("submitted");
    expect(derived.missingCompulsory).toHaveLength(0);
  });
});

describe("any branch", () => {
  const db: DemoDB = {
    committees: [], members: [], member_committees: [], templates: [],
    meeting_days: [{ id: "d1", date: "2026-02-10", title: null }],
    meeting_requirements: [
      { id: "r-any", meeting_day_id: "d1", template_id: null, label: "Any Submission", compulsory: 1, expected_kind: "any", status: "missing", active: 1, custom: 0 },
    ],
    attendance: [],
    submissions: [{ id: "s1", meeting_day_id: "d1", requirement_id: null, kind: "note", subsystem: null, content: "something", created_by: null, created_at: "2026-02-10T10:00:00Z", resolved: 0 }],
    media: [],
    deadlines: [],
  };

  it("single submission satisfies an any requirement", () => {
    const derived = deriveDay(db, "d1");
    expect(derived.requirements.find((r) => r.id === "r-any")!.status).toBe("submitted");
    expect(derived.missingCompulsory).toHaveLength(0);
  });
});
