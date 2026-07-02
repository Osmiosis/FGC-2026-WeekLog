// frontend/src/lib/demo/notebookReveal.ts
// Demo-only reveal state for the Notebook Prep tabs. The tabs start locked and a
// simulated Generate reveals the seeded reports. Kept in its own localStorage key
// so the DEMO Reset can re-lock them independently of the sample data graph.

const KEY = "weeklog-demo-notebook-reveal-v1";

export type Reveal = { timeline: boolean; reasoning: boolean };

const LOCKED: Reveal = { timeline: false, reasoning: false };

export function loadReveal(): Reveal {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...LOCKED };
    const r = JSON.parse(raw) as Partial<Reveal>;
    return { timeline: !!r.timeline, reasoning: !!r.reasoning };
  } catch {
    return { ...LOCKED };
  }
}

export function saveReveal(r: Reveal): void {
  localStorage.setItem(KEY, JSON.stringify(r));
}

// Re-lock: called by the DEMO Reset so the tabs return to their pre-generate state.
export function resetReveal(): void {
  localStorage.removeItem(KEY);
}
