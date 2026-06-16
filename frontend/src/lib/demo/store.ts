// frontend/src/lib/demo/store.ts
// localStorage-backed DemoDB. Seeds on first use; persists every mutation.
import type { DemoDB } from "./types";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "weeklog-demo-v1";

export function load(): DemoDB {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDB;
    } catch {
      // Corrupt payload — fall through to a fresh seed.
    }
  }
  const seed = buildSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

export function save(db: DemoDB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function reset(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeed()));
}
