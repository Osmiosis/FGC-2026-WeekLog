// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — connects the app to Better Auth (Google, bearer tokens).
// Build UI on top of useAuth() / the hooks in src/lib/hooks.
//
// NOTE: we drive auth via direct fetch against the Worker's Better Auth endpoints
// rather than better-auth/react's client session store. The client store relies on
// cross-origin cookies / its own token handling that does not reliably attach the
// bearer token on this Pages↔Worker split; direct fetch + /api/me (which we control)
// is deterministic. The token travels only as `Authorization: Bearer`.
// ─────────────────────────────────────────────────────────────────────────────
const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const API_BASE = apiBase ?? "";
export const isConfigured = Boolean(apiBase && googleClientId);
export const GOOGLE_CLIENT_ID = googleClientId ?? "";
export const TOKEN_KEY = "weeklog_bearer";

export const storeToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Exchange a Google ID token for a Better Auth session and store the bearer token
// returned in the `set-auth-token` response header.
export async function signInWithGoogleIdToken(
  idToken: string
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", idToken: { token: idToken } }),
    });
    if (!res.ok) {
      return { error: `Sign-in failed (${res.status}).` };
    }
    const token = res.headers.get("set-auth-token");
    if (!token) return { error: "No session token returned by the server." };
    storeToken(token);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign-in failed." };
  }
}

// Best-effort server sign-out; always clears the local token.
export async function signOutRequest(): Promise<void> {
  const token = getStoredToken();
  try {
    if (token) {
      await fetch(`${API_BASE}/api/auth/sign-out`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    /* ignore — the local clear below is what matters for the UI */
  }
  clearToken();
}
