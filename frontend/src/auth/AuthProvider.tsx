// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — do not edit during design work.
// Owns the auth session and role. Build login/role UI on top of useAuth().
// ─────────────────────────────────────────────────────────────────────────────
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

interface AuthState {
  session: Session | null;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  // Send a passwordless magic link to the given email.
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    // Only trust a successful response; a transient failure must not demote.
    api<{ email: string; isAdmin: boolean }>("/api/me")
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => {});
  }, [session]);

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  const sendMagicLink = async (email: string) => {
    if (!supabase) return { error: "Auth is not configured." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  };

  return (
    <Ctx.Provider
      value={{
        session,
        email: session?.user.email ?? null,
        isAdmin,
        loading,
        signOut,
        sendMagicLink,
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
