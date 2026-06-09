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

    const mediaName = names.find((n) => n.startsWith("media/"))!;
    expect(files[mediaName]).toEqual(photoBytes);
  });

  it("downloads all media in one ZIP", async () => {
    const res = await app.request("/api/export/all-media/zip", { headers: MEMBER }, env as never);
    expect(res.status).toBe(200);
    const files = await unzip(res);
    const names = Object.keys(files);
    expect(names.length).toBe(1);
    expect(names[0]).toContain(`days/${dayId}/`);
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
