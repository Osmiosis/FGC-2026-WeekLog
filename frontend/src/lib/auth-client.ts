// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — connects the app to Better Auth (Google, bearer tokens).
// Build UI on top of useAuth() / the hooks in src/lib/hooks.
// ─────────────────────────────────────────────────────────────────────────────
import { createAuthClient } from "better-auth/react";

const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const isConfigured = Boolean(apiBase && googleClientId);
export const GOOGLE_CLIENT_ID = googleClientId ?? "";
export const TOKEN_KEY = "weeklog_bearer";

export const storeToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const authClient = createAuthClient({
  baseURL: apiBase ?? "",
  fetchOptions: {
    // Capture the session token Better Auth returns after any auth call.
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) storeToken(token);
    },
    // Attach it as Authorization: Bearer on the client's own requests.
    auth: { type: "Bearer", token: () => getStoredToken() ?? "" },
  },
});
