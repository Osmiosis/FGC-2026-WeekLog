// frontend/src/lib/api.ts
// ─────────────────────────────────────────────────────────────────────────────
// DEMO BRANCH WIRING — replaces the real network layer with an in-browser mock.
// Signatures are identical to production so every hook/component is unchanged.
// There is no Worker; auth (Supabase magic-link) still gates the UI separately.
// ─────────────────────────────────────────────────────────────────────────────
import { route } from "./demo/router";
import { urlFor } from "./demo/media";
import { load } from "./demo/store";

// GET/POST/PATCH/DELETE with an optional JSON body, served by the demo router.
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : undefined;
  return route(method, path, body) as T;
}

// Multipart uploads (media) — pass the FormData straight through.
export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  return route("POST", path, undefined, form) as T;
}

// Media file: resolve the in-memory blob URL (or a placeholder) for /api/media/:id/file.
export async function apiBlobUrl(path: string): Promise<string> {
  const match = path.match(/\/api\/media\/([^/]+)\/file/);
  if (!match) throw new Error(`400: not a media path: ${path}`);
  return urlFor(match[1]);
}

// "Download" endpoints (ZIP). In the demo we generate a small text manifest so the
// button works without a backend, rather than zipping real binaries.
export async function downloadAuthed(path: string, filename: string): Promise<void> {
  const text = buildManifest(path);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.zip$/, ".txt");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buildManifest(path: string): string {
  const db = load();
  const dayMatch = path.match(/\/api\/meeting-days\/([^/]+)\/zip/);
  if (dayMatch) {
    const day = db.meeting_days.find((d) => d.id === dayMatch[1]);
    if (!day) return "Meeting day not found (demo).";
    const reqs = db.meeting_requirements.filter((r) => r.meeting_day_id === day.id && r.active === 1);
    const present = db.attendance.filter((a) => a.meeting_day_id === day.id && a.present === 1)
      .map((a) => db.members.find((m) => m.id === a.member_id)?.name).filter(Boolean);
    const subs = db.submissions.filter((s) => s.meeting_day_id === day.id);
    const lines = [
      `Meeting day ${day.date}${day.title ? ` (${day.title})` : ""}`,
      "",
      "## Requirements",
      ...reqs.map((r) => `- ${r.label}${r.compulsory ? "" : " (optional)"}`),
      "",
      "## Attendance (present)",
      ...present.map((n) => `- ${n}`),
      "",
      "## Submissions",
      ...subs.map((s) => `- [${s.kind}]${s.subsystem ? ` (${s.subsystem})` : ""} ${s.content ?? ""}`),
      "",
      "(Demo export — media files are omitted.)",
    ];
    return lines.join("\n");
  }
  return `Demo media export\n\n${db.media.length} media item(s) recorded.\n(Demo export — binaries are omitted.)`;
}
