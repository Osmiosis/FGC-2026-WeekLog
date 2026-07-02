// Cloudflare bindings + request-scoped variables shared across the Worker.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ADMIN_EMAIL: string;
  // Optional Drive connector config (v1 ships the NullDriveConnector). See drive.ts.
  DRIVE_ENABLED?: string;
  DRIVE_FOLDER_ID?: string;
  // Allowed browser origin for CORS (the deployed Pages URL). Defaults to "*".
  FRONTEND_ORIGIN?: string;
  // Shared secret for the offline pipeline's write-back to /api/notebook/publish.
  NOTEBOOK_PUBLISH_SECRET?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export type Variables = {
  user: AuthUser;
};
