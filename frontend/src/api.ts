import { supabase } from "./supabase";

// Fetch wrapper that attaches the current Supabase access token as a bearer.
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// POST multipart form data (e.g. media upload) with the bearer token attached.
// Does NOT set Content-Type, so the browser adds the multipart boundary.
export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const headers = new Headers();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const res = await fetch(path, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// Fetch an authed binary endpoint and return an object URL (for <img>/links).
// Caller should URL.revokeObjectURL when done.
export async function apiBlobUrl(path: string): Promise<string> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const headers = new Headers();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const res = await fetch(path, { headers });
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
