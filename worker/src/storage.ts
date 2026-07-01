import type { Env } from "./bindings";

// R2's free tier is 10 GB-month of stored data. We refuse uploads well below
// that line so the bucket can never cross the free limit by accident. Egress on
// R2 is free, and ~21 users will not approach the 1M write / 10M read op limits,
// so storage volume is the only meaningful guard.
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file (CAD/STEP headroom)
export const STORAGE_CEILING_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB total (margin under 10 GB)

export type BudgetResult = { ok: true } | { ok: false; status: 413 | 507; error: string };

// Decide whether an incoming upload of `incomingBytes` is allowed. Checks the
// per-file cap, then the running total of bytes already stored in `media`.
// Limits are injectable so tests can exercise the ceiling without huge files.
export async function checkStorageBudget(
  env: Env,
  incomingBytes: number,
  maxFile: number = MAX_FILE_BYTES,
  ceiling: number = STORAGE_CEILING_BYTES
): Promise<BudgetResult> {
  if (incomingBytes > maxFile) {
    const mb = Math.floor(maxFile / (1024 * 1024));
    return { ok: false, status: 413, error: `File too large. The limit is ${mb} MB per file.` };
  }
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(bytes), 0) AS total FROM media"
  ).first<{ total: number }>();
  const used = Number(row?.total ?? 0);
  if (used + incomingBytes > ceiling) {
    return { ok: false, status: 507, error: "Storage is full. Delete some media before uploading more." };
  }
  return { ok: true };
}
