// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — owns the auth session and role. Build login/role UI on
// top of useAuth(). Backed by Better Auth (Google, bearer tokens).
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient, clearToken, getStoredToken } from "../lib/auth-client";
import { api } from "../lib/api";

interface AuthState {
  session: boolean;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  // Exchange a Google ID token for a Better Auth session.
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  const signedIn = Boolean(data?.user?.email) && Boolean(getStoredToken());

  useEffect(() => {
    if (!signedIn) {
      setIsAdmin(false);
      return;
    }
    // Only trust a successful response; a transient failure must not demote.
    api<{ email: string; isAdmin: boolean }>("/api/me")
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => {});
  }, [signedIn]);

  const signOut = useCallback(async () => {
    await authClient.signOut().catch(() => {});
    clearToken();
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const { error } = await authClient.signIn.social({
      provider: "google",
      idToken: { token: idToken },
    });
    return { error: error ? (error.message ?? "Sign-in failed") : null };
  }, []);

  return (
    <Ctx.Provider
      value={{
        session: signedIn,
        email: data?.user?.email ?? null,
        isAdmin,
        loading: isPending,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
