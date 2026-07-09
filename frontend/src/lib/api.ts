// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — do not edit during design work.
// All network access goes through here: it attaches the Supabase bearer token
// (refreshing it when expired) and targets the API base. Changing it can break
// auth and every data call. Design agents: use the hooks in src/lib/hooks.
// ─────────────────────────────────────────────────────────────────────────────
import { getStoredToken } from "./auth-client";

// In dev this is empty and the Vite proxy forwards /api to the local Worker.
// In production set VITE_API_BASE to the deployed Worker URL.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// Return the stored bearer token, if any. Better Auth validates it server-side;
// an expired token yields a 401 and the app returns the user to the login wall.
async function getFreshToken(): Promise<string | null> {
  return getStoredToken();
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getFreshToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function apiForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const token = await getFreshToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function apiBlobUrl(path: string): Promise<string> {
  const token = await getFreshToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Raw bytes for one authed GET (used by the client-side ZIP builder).
export async function apiBytes(path: string): Promise<Uint8Array> {
  const token = await getFreshToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

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
