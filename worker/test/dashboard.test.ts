import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { addDaysUTC } from "../src/compliance";
import { makeTestDb, testEnv } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

type Dash = {
  overall: string;
  counts: { daysFlagged: number; deadlinesOverdue: number; deadlinesDueSoon: number };
  needsAttention: Array<{ type: string; id: string }>;
  thisWeek: Array<{ id: string; date: string; status: string }>;
  upcomingDeadlines: Array<{ id: string; daysUntil: number }>;
};

async function getDash(env: unknown): Promise<Dash> {
  const res = await app.request("/api/dashboard", { headers: MEMBER }, env as never);
  return (await res.json()) as Dash;
}
async function markDay(env: unknown, date: string): Promise<string> {
  const res = await app.request(
    "/api/meeting-days",
    { method: "POST", headers: ADMIN, body: JSON.stringify({ date }) },
    env as never
  );
  return ((await res.json()) as { id: string }).id;
}

describe("dashboard", () => {
  let env: Record<string, unknown>;

  beforeEach(async () => {
    env = testEnv(makeTestDb());
    // Remove the seeded deadline so each test controls the deadline set.
    await app.request("/api/deadlines/dl-sm-1", { method: "DELETE", headers: ADMIN }, env as never);
  });

  it("is green when there is nothing flagged", async () => {
    const d = await getDash(env);
    expect(d.overall).toBe("green");
    expect(d.counts.daysFlagged).toBe(0);
  });

  it("flags a past empty meeting day as red and needs-attention", async () => {
    const date = addDaysUTC(todayUTC(), -10);
    const id = await markDay(env, date);
    const d = await getDash(env);
    expect(d.overall).toBe("red");
    expect(d.counts.daysFlagged).toBe(1);
    expect(d.needsAttention.some((n) => n.type === "day" && n.id === id)).toBe(true);
  });

  it("includes overdue deadlines in needs-attention", async () => {
    await app.request(
      "/api/deadlines",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ title: "Late thing", due_date: addDaysUTC(todayUTC(), -2) }),
      },
      env as never
    );
    const d = await getDash(env);
    expect(d.counts.deadlinesOverdue).toBe(1);
    expect(d.needsAttention.some((n) => n.type === "deadline")).toBe(true);
    expect(d.overall).toBe("red");
  });

  it("puts a current-week meeting day in thisWeek and future deadlines in upcoming", async () => {
    await markDay(env, todayUTC()); // today is always within the current week
    await app.request(
      "/api/deadlines",
      {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ title: "Soon", due_date: addDaysUTC(todayUTC(), 5) }),
      },
      env as never
    );
    const d = await getDash(env);
    expect(d.thisWeek.some((x) => x.date === todayUTC())).toBe(true);
    const soon = d.upcomingDeadlines.find((u) => u.daysUntil === 5);
    expect(soon).toBeDefined();
  });
});
