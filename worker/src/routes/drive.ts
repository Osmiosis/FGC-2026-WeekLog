import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import { getDriveConnector } from "../drive";

// Drive sync seam (mounted at /api/drive). v1 always reports not configured.
export const driveRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

driveRoutes.get("/status", requireUser, (c) => {
  const connector = getDriveConnector(c.env);
  return c.json({ configured: connector.isConfigured() });
});

// Push a day's media to Drive if configured; otherwise a no-op. The UI offers a
// ZIP download for manual upload when this is not configured.
driveRoutes.post("/push/:dayId", requireUser, async (c) => {
  const connector = getDriveConnector(c.env);
  if (!connector.isConfigured()) {
    return c.json({
      configured: false,
      message: "Drive sync is not configured. Download the day ZIP and upload it manually.",
    });
  }
  const result = await connector.pushDayMedia(c.req.param("dayId"));
  return c.json({ configured: true, ...result });
});
