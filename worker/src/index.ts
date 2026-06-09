import { Hono } from "hono";

// Cloudflare bindings (D1 + R2) declared now so later phases attach to the same Env.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  TEAM_PASSWORD_HASH: string;
  ADMIN_PASSWORD_HASH: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "weeklog-worker" }));

export default app;
