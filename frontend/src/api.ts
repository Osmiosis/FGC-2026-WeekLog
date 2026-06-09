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
