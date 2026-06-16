// frontend/src/lib/demo/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { load, save, reset, STORAGE_KEY } from "./store";

beforeEach(() => localStorage.clear());

describe("store", () => {
  it("seeds on first load and persists the same data on next load", () => {
    const a = load();
    expect(a.members.length).toBeGreaterThan(0);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    const b = load();
    expect(b.meeting_days.map((d) => d.id)).toEqual(a.meeting_days.map((d) => d.id));
  });

  it("save persists mutations", () => {
    const db = load();
    db.members.push({ id: "zz", name: "New Person", active: 1 });
    save(db);
    expect(load().members.find((m) => m.id === "zz")).toBeTruthy();
  });

  it("reset restores a fresh seed", () => {
    const db = load();
    db.members = [];
    save(db);
    expect(load().members.length).toBe(0);
    reset();
    expect(load().members.length).toBeGreaterThan(0);
  });
});
