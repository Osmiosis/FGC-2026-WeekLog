import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { makeTestDb, testEnv, stubSupabaseAuth, D1Shim } from "./helpers/d1";

const ADMIN = { Authorization: "Bearer admin-token" };
const MEMBER = { Authorization: "Bearer member-token" };

type Detail = {
  id: string;
  requirements: Array<{ id: string; label: string; expected_kind: string | null; status: string }>;
  missingCompulsory: Array<{ label: string }>;
};

async function markDay(env: unknown): Promise<string> {
  const res = await app.request(
    "/api/meeting-days",
    { method: "POST", headers: ADMIN, body: JSON.stringify({ date: "2026-07-07" }) },
    env as never
  );
  return ((await res.json()) as { id: string }).id;
}

async function getDetail(env: unknown, id: string): Promise<Detail> {
  const res = await app.request(`/api/meeting-days/${id}`, { headers: MEMBER }, env as never);
  return (await res.json()) as Detail;
}

describe("meeting day detail", () => {
  let env: Record<string, unknown>;

  beforeEach(() => {
    stubSupabaseAuth();
    env = testEnv(makeTestDb());
  });

  it("reports six missing compulsory items on a fresh day", async () => {
    const id = await markDay(env);
    const d = await getDetail(env, id);
    expect(d.missingCompulsory.length).toBe(6);
  });

  it("satisfies the attendance requirement when someone is marked present", async () => {
    const id = await markDay(env);
    const before = await getDetail(env, id);
    const attReq = before.requirements.find((r) => r.expected_kind === "attendance")!;
    expect(attReq.status).toBe("missing");

    await app.request(
      `/api/meeting-days/${id}/attendance`,
      { method: "POST", headers: MEMBER, body: JSON.stringify({ member_id: "m-01", present: 1 }) },
      env as never
    );

    const after = await getDetail(env, id);
    const att = after.requirements.find((r) => r.expected_kind === "attendance")!;
    expect(att.status).toBe("submitted");
    expect(after.missingCompulsory.length).toBe(5);
  });

  it("lists the roster for attendance with present defaulting to 0", async () => {
    const id = await markDay(env);
    const res = await app.request(
      `/api/meeting-days/${id}/attendance`,
      { headers: MEMBER },
      env as never
    );
    const rows = (await res.json()) as Array<{ member_id: string; present: number }>;
    expect(rows.length).toBe(21);
    expect(rows.every((r) => r.present === 0)).toBe(true);
  });

  it("satisfies a text requirement via a submission tied to it", async () => {
    const id = await markDay(env);
    const d = await getDetail(env, id);
    const acc = d.requirements.find((r) => r.label === "Robot accomplishments")!;

    const post = await app.request(
      `/api/meeting-days/${id}/submissions`,
      {
        method: "POST",
        headers: MEMBER,
        body: JSON.stringify({ kind: "accomplishment", content: "Drivetrain works", requirement_id: acc.id }),
      },
      env as never
    );
    expect(post.status).toBe(201);

    const after = await getDetail(env, id);
    const accAfter = after.requirements.find((r) => r.id === acc.id)!;
    expect(accAfter.status).toBe("submitted");
  });

  it("lets the author delete a submission but forbids other members", async () => {
    const id = await markDay(env);
    const post = await app.request(
      `/api/meeting-days/${id}/submissions`,
      { method: "POST", headers: ADMIN, body: JSON.stringify({ kind: "note", content: "x" }) },
      env as never
    );
    const subId = ((await post.json()) as { id: string }).id;

    // A different user (member) cannot delete the admin's submission.
    const forbidden = await app.request(
      `/api/submissions/${subId}`,
      { method: "DELETE", headers: MEMBER },
      env as never
    );
    expect(forbidden.status).toBe(403);

    const ok = await app.request(
      `/api/submissions/${subId}`,
      { method: "DELETE", headers: ADMIN },
      env as never
    );
    expect(ok.status).toBe(200);
  });

  it("uploads media to R2, lists it, serves the bytes, and satisfies a media requirement", async () => {
    const id = await markDay(env);
    const d = await getDetail(env, id);
    const photoReq = d.requirements.find((r) => r.label === "Photos from the meeting")!;

    const form = new FormData();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    form.set("file", new File([bytes], "photo.png", { type: "image/png" }));
    form.set("kind", "photo");
    form.set("requirement_id", photoReq.id);

    const up = await app.request(
      `/api/meeting-days/${id}/media`,
      { method: "POST", headers: MEMBER, body: form },
      env as never
    );
    expect(up.status).toBe(201);
    const mediaRow = (await up.json()) as { id: string; r2_key: string; content_type: string };
    expect(mediaRow.content_type).toBe("image/png");

    const list = await app.request(
      `/api/meeting-days/${id}/media`,
      { headers: MEMBER },
      env as never
    );
    expect(((await list.json()) as unknown[]).length).toBe(1);

    const file = await app.request(
      `/api/media/${mediaRow.id}/file`,
      { headers: MEMBER },
      env as never
    );
    expect(file.status).toBe(200);
    expect(file.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);

    const after = await getDetail(env, id);
    const photoAfter = after.requirements.find((r) => r.id === photoReq.id)!;
    expect(photoAfter.status).toBe("submitted");
  });

  it("deletes media (uploader) and removes the R2 object", async () => {
    const id = await markDay(env);
    const form = new FormData();
    form.set("file", new File([new Uint8Array([9])], "a.bin", { type: "application/octet-stream" }));
    const up = await app.request(
      `/api/meeting-days/${id}/media`,
      { method: "POST", headers: MEMBER, body: form },
      env as never
    );
    const mediaId = ((await up.json()) as { id: string }).id;

    const del = await app.request(
      `/api/media/${mediaId}`,
      { method: "DELETE", headers: MEMBER },
      env as never
    );
    expect(del.status).toBe(200);

    const file = await app.request(
      `/api/media/${mediaId}/file`,
      { headers: MEMBER },
      env as never
    );
    expect(file.status).toBe(404);
  });
});
