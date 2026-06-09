import { supabase } from "./supabase";

// In dev this is empty and the Vite proxy forwards /api to the local Worker.
// In production set VITE_API_BASE to the deployed Worker URL (e.g. the workers.dev URL).
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// Return a valid access token, refreshing it if it has expired or is about to.
// Without this, an expired token (Supabase tokens last ~1 hour) produces spurious
// 401s that would otherwise demote an admin to a member or appear as a logout.
async function getFreshToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() < 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? null;
  }
  return session.access_token;
}

// Fetch wrapper that attaches a fresh Supabase access token as a bearer.
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getFreshToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// POST multipart form data (e.g. media upload) with the bearer token attached.
// Does NOT set Content-Type, so the browser adds the multipart boundary.
export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const token = await getFreshToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// Fetch an authed binary endpoint and return an object URL (for <img>/links).
// Caller should URL.revokeObjectURL when done.
export async function apiBlobUrl(path: string): Promise<string> {
  const token = await getFreshToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Fetch an authed endpoint and trigger a browser download (e.g. a ZIP).
export async function downloadAuthed(path: string, filename: string): Promise<void> {
  const url = await apiBlobUrl(path);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
