import { describe, it, expect, beforeEach } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

async function unzip(res: Response): Promise<Record<string, Uint8Array>> {
  const buf = new Uint8Array(await res.arrayBuffer());
  return unzipSync(buf);
}

describe("zip export + drive seam", () => {
  let env: Record<string, unknown>;
  let dayId: string;
  const photoBytes = new Uint8Array([10, 20, 30, 40]);

  beforeEach(async () => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
    const mk = await app.request(
      "/api/meeting-days",
      { method: "POST", headers: ADMIN, body: JSON.stringify({ date: "2026-07-07" }) },
      env as never
    );
    dayId = ((await mk.json()) as { id: string }).id;
    await app.request(
      `/api/meeting-days/${dayId}/submissions`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ kind: "accomplishment", content: "Shooter tuned" }) },
      env as never
    );
    const form = new FormData();
    form.set("file", new File([photoBytes], "shot.png", { type: "image/png" }));
    await app.request(
      `/api/meeting-days/${dayId}/media`,
      { method: "POST", headers: MEMBER, body: form },
      env as never
    );
  });

  it("downloads a day ZIP with summary and media", async () => {
    const res = await app.request(`/api/meeting-days/${dayId}/zip`, { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");

    const files = await unzip(res);
    const names = Object.keys(files);
    expect(names).toContain("summary.md");
    expect(names).toContain("summary.json");
    expect(names.some((n) => n.startsWith("media/"))).toBe(true);

    const md = strFromU8(files["summary.md"]);
    expect(md).toContain("Shooter tuned");

    // Clean filename (no uuid prefix).
    expect(names).toContain("media/shot.png");
    expect(files["media/shot.png"]).toEqual(photoBytes);
  });

  it("downloads all media in one ZIP foldered by readable names", async () => {
    const res = await app.request("/api/export/all-media/zip", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const files = await unzip(res);
    const names = Object.keys(files);
    // Foldered by meeting date, original filename, no uuids.
    expect(names).toContain("meetings/2026-07-07/shot.png");
    // Text travels with the media: per-meeting summary carries the submission.
    expect(names).toContain("meetings/2026-07-07/summary.md");
    expect(strFromU8(files["meetings/2026-07-07/summary.md"])).toContain("Shooter tuned");
  });

  it("streams every media file when several share a day (and a filename)", async () => {
    // Two more uploads, one colliding on the original filename, exercise the
    // sequential streaming path and uniquePath de-duplication.
    for (const [name, bytes] of [
      ["clip.mp4", new Uint8Array([1, 2, 3])],
      ["shot.png", new Uint8Array([9, 9, 9, 9, 9])], // same name as beforeEach upload
    ] as const) {
      const form = new FormData();
      form.set("file", new File([bytes], name, { type: "application/octet-stream" }));
      await app.request(`/api/meeting-days/${dayId}/media`, { method: "POST", headers: MEMBER, body: form }, env as never);
    }

    const res = await app.request("/api/export/all-media/zip", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const files = await unzip(res);
    const names = Object.keys(files);
    // All three media land, and the duplicate name is disambiguated, not dropped.
    expect(names).toContain("meetings/2026-07-07/shot.png");
    expect(names).toContain("meetings/2026-07-07/clip.mp4");
    expect(names).toContain("meetings/2026-07-07/shot (2).png");
    expect(files["meetings/2026-07-07/clip.mp4"]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("reports Drive as not configured and treats push as a no-op", async () => {
    const status = await app.request("/api/drive/status", { headers: MEMBER }, env as never);
    expect((await status.json()) as unknown).toEqual({ configured: false });

    const push = await app.request(
      `/api/drive/push/${dayId}`,
      { method: "POST", headers: MEMBER },
      env as never
    );
    expect(((await push.json()) as { configured: boolean }).configured).toBe(false);
  });
});
