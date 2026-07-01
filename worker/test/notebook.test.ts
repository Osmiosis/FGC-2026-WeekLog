import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

describe("notebook prep", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("starts with no reports", async () => {
    const res = await app.request("/api/notebook/reports", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("lets a member queue a refresh request the admin can see", async () => {
    const post = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "timeline" }) },
      env as never
    );
    expect(post.status).toBe(200);

    const list = await app.request("/api/notebook/requests", { headers: ADMIN }, env as never);
    const summary = (await list.json()) as { kind: string; count: number; latest_requested_at: string }[];
    expect(summary).toEqual([{ kind: "timeline", count: 1, latest_requested_at: expect.any(String) }]);
  });

  it("rejects an unknown request kind", async () => {
    const res = await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "bogus" }) },
      env as never
    );
    expect(res.status).toBe(400);
  });

  async function seedSeason() {
    const mk = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ date: "2026-07-07" }) },
      env as never
    );
    const dayId = ((await mk.json()) as { id: string }).id;
    const sub = (kind: string, subsystem: string | null, content: string) =>
      app.request(
        `/api/meeting-days/${dayId}/submissions`,
        { method: "POST", headers: MEMBER, body: JSON.stringify({ kind, subsystem, content }) },
        env as never
      );
    await sub("accomplishment", "Shooter", "Shooter tuned");
    await sub("failure", "Climber", "Hook slipped");
    await sub("note", null, "General note");
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }));
    await app.request(`/api/meeting-days/${dayId}/media`, { method: "POST", headers: MEMBER, body: form }, env as never);
    return dayId;
  }

  it("admin generate builds the timeline snapshot from logged data", async () => {
    await seedSeason();
    const gen = await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    expect(gen.status).toBe(200);

    const map = (await (await app.request("/api/notebook/reports", { headers: MEMBER }, env as never)).json()) as Record<
      string,
      { payload: { subsystems: { name: string; entries: { text: string; kind: string }[] }[]; photosByDate: { date: string; photos: unknown[] }[] } }
    >;
    const tl = map.timeline.payload;
    const names = tl.subsystems.map((s) => s.name);
    expect(names).toContain("Shooter");
    expect(names).toContain("Climber");
    expect(names).toContain("Uncategorized"); // the null-subsystem note lands here
    const shooter = tl.subsystems.find((s) => s.name === "Shooter")!;
    expect(shooter.entries[0]).toMatchObject({ text: "Shooter tuned", kind: "accomplishment" });
    expect(tl.photosByDate).toEqual([{ date: "2026-07-07", photos: [{ caption: "", kind: expect.any(String) }] }]);
  });

  it("generate is admin-only and fulfils pending timeline requests", async () => {
    await seedSeason();
    await app.request(
      "/api/notebook/requests",
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "timeline" }) },
      env as never
    );

    const forbidden = await app.request("/api/notebook/generate/timeline", { method: "POST", headers: MEMBER }, env as never);
    expect(forbidden.status).toBe(403);

    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    const pending = (await (await app.request("/api/notebook/requests", { headers: ADMIN }, env as never)).json()) as unknown[];
    expect(pending).toEqual([]); // the pending timeline request is now fulfilled
  });

  it("re-generating replaces the snapshot, not duplicates it", async () => {
    await seedSeason();
    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    await app.request("/api/notebook/generate/timeline", { method: "POST", headers: ADMIN }, env as never);
    const rows = (await (env.DB as { prepare: (s: string) => { all: () => Promise<{ results: unknown[] }> } })
      .prepare("SELECT id FROM notebook_reports WHERE kind='timeline'")
      .all()).results;
    expect(rows.length).toBe(1);
  });

  it("coverage counts entries, failures, build-needs, numerics, and photos", async () => {
    const dayId = await seedSeason();
    // A numeric build-need on Shooter (open by default).
    await app.request(
      `/api/meeting-days/${dayId}/submissions`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "build_need", subsystem: "Shooter", content: "Need 4 more 80mm wheels" }) },
      env as never
    );

    const res = await app.request("/api/notebook/coverage", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const cov = (await res.json()) as {
      subsystems: { name: string; entries: number; failures: number; buildNeedsOpen: number; numericEntries: number }[];
      photos: { total: number; byKind: Record<string, number> };
      totals: { submissions: number; failures: number; numericEntries: number };
    };
    const shooter = cov.subsystems.find((s) => s.name === "Shooter")!;
    expect(shooter.entries).toBe(2); // accomplishment + build_need
    expect(shooter.buildNeedsOpen).toBe(1);
    expect(shooter.numericEntries).toBe(1); // "Need 4 more..." contains a digit
    expect(cov.subsystems.find((s) => s.name === "Climber")!.failures).toBe(1);
    expect(cov.subsystems.some((s) => s.name === "Uncategorized")).toBe(true); // the null-subsystem note
    expect(cov.photos.total).toBe(1);
    expect(cov.totals.failures).toBe(1);
  });

  it("season export returns normalized data with media metadata only", async () => {
    await seedSeason();
    const res = await app.request("/api/notebook/season", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const season = (await res.json()) as {
      meetingDays: { date: string }[];
      submissions: { date: string; kind: string; content: string | null }[];
      media: { caption: string | null; kind: string | null; onMeetingDay: boolean }[];
    };
    expect(season.meetingDays.some((d) => d.date === "2026-07-07")).toBe(true);
    expect(season.submissions.some((s) => s.content === "Shooter tuned")).toBe(true); // verbatim
    expect(season.media.length).toBe(1);
    expect(season.media[0].onMeetingDay).toBe(true);
    expect(season.media[0]).not.toHaveProperty("r2_key"); // metadata only, no bytes/keys
  });
});
