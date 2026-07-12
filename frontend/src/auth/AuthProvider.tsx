// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — owns the auth session and role. Build login/role UI on
// top of useAuth(). Backed by Better Auth (Google, bearer tokens) via direct
// fetch: sign-in exchanges the Google ID token for a bearer token, and /api/me
// (which we control) is the single source of truth for signed-in + role.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getStoredToken, signInWithGoogleIdToken, signOutRequest } from "../lib/auth-client";
import { api } from "../lib/api";

interface AuthState {
  session: boolean;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  // Exchange a Google ID token for a session, then refresh from /api/me.
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>;
  // DEMO SITE ONLY: enter with a synthetic admin session, no Google. Reads (public
  // requireUser routes) work; server-side admin writes have no token and will 401.
  demoSignIn: () => void;
}

type SessionState = { loading: boolean; session: boolean; email: string | null; isAdmin: boolean };
const SIGNED_OUT: SessionState = { loading: false, session: false, email: null, isAdmin: false };

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ...SIGNED_OUT, loading: true });

  // Read identity + role from /api/me using the stored bearer token. This is the
  // single source of truth: a token that /api/me accepts means signed-in.
  const refresh = useCallback(async () => {
    if (!getStoredToken()) {
      setState(SIGNED_OUT);
      return;
    }
    try {
      const me = await api<{ email: string; isAdmin: boolean }>("/api/me");
      if (me.email) {
        setState({ loading: false, session: true, email: me.email, isAdmin: me.isAdmin });
      } else {
        setState(SIGNED_OUT);
      }
    } catch {
      // api() clears the token on a 401; treat any failure here as signed-out.
      setState(SIGNED_OUT);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const { error } = await signInWithGoogleIdToken(idToken);
      if (error) return { error };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    setState(SIGNED_OUT);
  }, []);

  const demoSignIn = useCallback(() => {
    setState({ loading: false, session: true, email: "reviewer@teamqatar.demo", isAdmin: true });
  }, []);

  return (
    <Ctx.Provider
      value={{
        session: state.session,
        email: state.email,
        isAdmin: state.isAdmin,
        loading: state.loading,
        signOut,
        signInWithGoogle,
        demoSignIn,
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
