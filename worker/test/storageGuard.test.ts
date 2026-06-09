import { describe, it, expect } from "vitest";
import { checkStorageBudget, MAX_FILE_BYTES, STORAGE_CEILING_BYTES } from "../src/storage";
import { makeTestDb, testEnv } from "./helpers/d1";
import type { Env } from "../src/bindings";

describe("storage budget guard", () => {
  it("rejects a single file larger than the per-file cap", async () => {
    const env = testEnv(makeTestDb()) as unknown as Env;
    const res = await checkStorageBudget(env, MAX_FILE_BYTES + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it("allows a normal-sized file when storage is empty", async () => {
    const env = testEnv(makeTestDb()) as unknown as Env;
    const res = await checkStorageBudget(env, 2 * 1024 * 1024);
    expect(res.ok).toBe(true);
  });

  it("rejects an upload that would cross the total storage ceiling", async () => {
    const db = makeTestDb();
    const env = testEnv(db) as unknown as Env;
    // Seed one media row that already fills most of a tiny test ceiling.
    await db
      .prepare(
        "INSERT INTO media (id, r2_key, bytes, uploaded_at) VALUES ('m-big', 'k', 900, '2026-01-01')"
      )
      .run();
    // Tiny injected limits: 1000-byte ceiling, 1000-byte per-file cap.
    const res = await checkStorageBudget(env, 200, 1000, 1000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(507);
  });

  it("allows an upload that stays under the ceiling", async () => {
    const db = makeTestDb();
    const env = testEnv(db) as unknown as Env;
    await db
      .prepare(
        "INSERT INTO media (id, r2_key, bytes, uploaded_at) VALUES ('m-1', 'k', 400, '2026-01-01')"
      )
      .run();
    const res = await checkStorageBudget(env, 200, 1000, 1000);
    expect(res.ok).toBe(true);
  });

  it("keeps the real ceiling safely under the R2 10 GB free tier", () => {
    expect(STORAGE_CEILING_BYTES).toBeLessThan(10 * 1024 * 1024 * 1024);
  });
});
