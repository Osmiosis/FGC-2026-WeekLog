import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { dayRag, deadlineRag } from "../src/compliance";
import { makeTestDb, testEnv } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysUTC(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("compliance engine (pure)", () => {
  const today = "2026-06-09";

  it("day is green when all compulsory are satisfied, regardless of date", () => {
    expect(dayRag({ date: "2020-01-01", today, compulsoryTotal: 6, compulsorySatisfied: 6 })).toBe("green");
  });
  it("day is red when past and incomplete", () => {
    expect(dayRag({ date: "2026-06-01", today, compulsoryTotal: 6, compulsorySatisfied: 3 })).toBe("red");
  });
  it("day is amber when today and incomplete", () => {
    expect(dayRag({ date: today, today, compulsoryTotal: 6, compulsorySatisfied: 1 })).toBe("amber");
  });
  it("day is amber when future and incomplete", () => {
    expect(dayRag({ date: "2026-07-01", today, compulsoryTotal: 6, compulsorySatisfied: 0 })).toBe("amber");
  });
  it("day is green when there are no compulsory items", () => {
    expect(dayRag({ date: "2026-06-01", today, compulsoryTotal: 0, compulsorySatisfied: 0 })).toBe("green");
  });

  it("deadline done is green", () => {
    expect(deadlineRag({ status: "done", due_date: "2026-06-01", today })).toBe("green");
  });
  it("deadline open and overdue is red", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-06-08", today })).toBe("red");
  });
  it("deadline open and due within 7 days is amber", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-06-12", today })).toBe("amber");
  });
  it("deadline open and far out is green", () => {
    expect(deadlineRag({ status: "open", due_date: "2026-08-01", today })).toBe("green");
  });
});

describe("compliance integration (relative to real today)", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    env = testEnv(makeTestDb());
  });

  async function markDay(date: string): Promise<string> {
    const res = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ date }) },
      env as never
    );
    return ((await res.json()) as { id: string }).id;
  }
  async function listStatus(date: string): Promise<string> {
    const res = await app.request(
      `/api/meeting-days?from=${date}&to=${date}`,
      { headers: MEMBER },
      env as never
    );
    const rows = (await res.json()) as Array<{ date: string; status: string }>;
    return rows[0].status;
  }

  it("a past empty meeting day is red", async () => {
    const date = addDaysUTC(todayUTC(), -10);
    await markDay(date);
    expect(await listStatus(date)).toBe("red");
  });

  it("a future empty meeting day is amber", async () => {
    const date = addDaysUTC(todayUTC(), 10);
    await markDay(date);
    expect(await listStatus(date)).toBe("amber");
  });

  it("completing all compulsory turns a past day green and caches submitted", async () => {
    const date = addDaysUTC(todayUTC(), -10);
    const id = await markDay(date);

    const detail = (await (
      await app.request(`/api/meeting-days/${id}`, { headers: ADMIN }, env as never)
    ).json()) as { requirements: Array<{ id: string; compulsory: number; expected_kind: string | null }> };

    for (const r of detail.requirements.filter((x) => x.compulsory === 1)) {
      if (r.expected_kind === "attendance") {
        await app.request(
          `/api/meeting-days/${id}/attendance`,
          { method: "POST", headers: MEMBER, body: JSON.stringify({ member_id: "m-01", present: 1 }) },
          env as never
        );
      } else if (r.expected_kind === "text") {
        await app.request(
          `/api/meeting-days/${id}/submissions`,
          { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "note", content: "x", requirement_id: r.id }) },
          env as never
        );
      } else if (r.expected_kind === "media") {
        const form = new FormData();
        form.set("file", new File([new Uint8Array([1])], "f.png", { type: "image/png" }));
        form.set("requirement_id", r.id);
        await app.request(
          `/api/meeting-days/${id}/media`,
          { method: "POST", headers: MEMBER, body: form },
          env as never
        );
      }
    }

    expect(await listStatus(date)).toBe("green");

    // Cache (meeting_requirements.status) reflects the completion.
    const after = (await (
      await app.request(`/api/meeting-days/${id}`, { headers: ADMIN }, env as never)
    ).json()) as { requirements: Array<{ compulsory: number; status: string }> };
    const compulsory = after.requirements.filter((r) => r.compulsory === 1);
    expect(compulsory.every((r) => r.status === "submitted")).toBe(true);
  });
});
