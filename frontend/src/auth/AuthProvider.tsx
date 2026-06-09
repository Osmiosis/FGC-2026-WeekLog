import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { api } from "../api";

interface AuthState {
  session: Session | null;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
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
    // Only trust a successful response. A transient failure (e.g. a token mid
    // refresh) must NOT demote an admin to member; keep the prior value.
    api<{ email: string; isAdmin: boolean }>("/api/me")
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => {});
  }, [session]);

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        session,
        email: session?.user.email ?? null,
        isAdmin,
        loading,
        signOut,
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
