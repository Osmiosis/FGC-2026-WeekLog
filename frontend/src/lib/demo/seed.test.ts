// frontend/src/lib/demo/seed.test.ts
import { describe, it, expect } from "vitest";
import { buildSeed } from "./seed";
import { deriveDay, dayStatusFromDerived, todayUTC } from "./compute";

describe("buildSeed", () => {
  it("produces a populated, varied dataset", () => {
    const db = buildSeed();
    expect(db.members.length).toBeGreaterThanOrEqual(6);
    expect(db.committees.length).toBeGreaterThanOrEqual(3);
    expect(db.templates.filter((t) => t.active === 1).length).toBeGreaterThanOrEqual(3);
    expect(db.meeting_days.length).toBeGreaterThanOrEqual(5);
    expect(db.deadlines.length).toBeGreaterThanOrEqual(4);

    for (const d of db.meeting_days) {
      expect(db.meeting_requirements.some((r) => r.meeting_day_id === d.id)).toBe(true);
    }

    const today = todayUTC();
    const statuses = db.meeting_days.map((d) => dayStatusFromDerived(d.date, today, deriveDay(db, d.id)));
    expect(statuses).toContain("green");
    expect(statuses.some((s) => s !== "green")).toBe(true);
  });

  it("returns a fresh independent copy each call", () => {
    const a = buildSeed();
    const b = buildSeed();
    a.members.push({ id: "x", name: "Z", active: 1 });
    expect(b.members.find((m) => m.id === "x")).toBeUndefined();
  });
});
