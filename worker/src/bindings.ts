// Cloudflare bindings + request-scoped variables shared across the Worker.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ADMIN_EMAIL: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export type Variables = {
  user: AuthUser;
};
