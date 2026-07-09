// Cloudflare bindings + request-scoped variables shared across the Worker.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ADMIN_EMAIL: string;
  // Better Auth
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Demo: when "true", every signed-in user is treated as admin (all origins).
  DEMO_ALL_ADMIN?: string;
  // Per-site demo: requests from this exact origin treat every signed-in user as
  // admin (the demo Pages site), while other origins use ADMIN_EMAIL gating.
  DEMO_ORIGIN?: string;
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
