// frontend/src/lib/api.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { api, apiForm, apiBlobUrl } from "./api";

beforeEach(() => localStorage.clear());

describe("demo api layer", () => {
  it("api() routes GET to the demo router", async () => {
    const me = await api<{ isAdmin: boolean }>("/api/me");
    expect(me.isAdmin).toBe(true);
  });

  it("api() routes a POST with a JSON body", async () => {
    const days = await api<Array<{ id: string }>>("/api/meeting-days");
    const id = days[0].id;
    const att = await api<Array<{ member_id: string }>>(`/api/meeting-days/${id}/attendance`);
    const res = await api<{ ok: boolean }>(`/api/meeting-days/${id}/attendance`, {
      method: "POST",
      body: JSON.stringify({ member_id: att[0].member_id, present: 1 }),
    });
    expect(res.ok).toBe(true);
  });

  it("apiForm() accepts a media upload and returns a row", async () => {
    const days = await api<Array<{ id: string }>>("/api/meeting-days");
    const form = new FormData();
    form.set("file", new File(["x"], "p.png", { type: "image/png" }));
    const row = await apiForm<{ id: string }>(`/api/meeting-days/${days[0].id}/media`, form);
    expect(row.id).toBeTruthy();
  });

  it("apiBlobUrl() returns a usable URL for media", async () => {
    const url = await apiBlobUrl("/api/media/anything/file");
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
