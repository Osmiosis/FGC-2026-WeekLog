// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — do not edit during design work.
// This file connects the app to Supabase auth. Changing it can break login.
// Design agents: build UI on top of the hooks in src/lib/hooks and useAuth().
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// If env is missing we render a setup screen instead of crashing on createClient.
export const isConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, key as string)
  : null;
