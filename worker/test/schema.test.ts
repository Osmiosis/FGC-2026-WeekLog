import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function sql(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

describe("D1 migration + seed", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(sql("../migrations/0001_init.sql"));
    db.exec(sql("../migrations/0002_seed.sql"));
  });

  it("creates every Section 4 table", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    for (const t of [
      "members",
      "requirement_templates",
      "meeting_days",
      "meeting_requirements",
      "submissions",
      "attendance",
      "media",
      "deadlines",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("seeds the six page-42 compulsory templates", () => {
    const rows = db
      .prepare(
        "SELECT label FROM requirement_templates WHERE compulsory=1 ORDER BY sort_order"
      )
      .all()
      .map((r: any) => r.label);
    expect(rows).toEqual([
      "Attendance records",
      "Robot accomplishments",
      "Build needs",
      "Performance goals",
      "Photos from the meeting",
      "Photos of all plans/designs/sketches",
    ]);
  });

  it("seeds three optional templates", () => {
    const n = db
      .prepare("SELECT COUNT(*) AS n FROM requirement_templates WHERE compulsory=0")
      .get() as any;
    expect(n.n).toBe(3);
  });

  it("seeds the example social media deadline", () => {
    const row = db
      .prepare("SELECT category FROM deadlines WHERE title LIKE 'SM Challenge #1%'")
      .get() as any;
    expect(row.category).toBe("social_media");
  });
});
