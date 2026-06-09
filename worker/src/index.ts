import { Hono } from "hono";
import type { Env, Variables } from "./bindings";
import { requireUser, isAdmin } from "./auth";
import { members } from "./routes/members";
import { templates } from "./routes/templates";
import { meetingDays } from "./routes/meetingDays";
import { submissions } from "./routes/submissions";
import { media } from "./routes/media";
import { deadlines } from "./routes/deadlines";
import { dashboard } from "./routes/dashboard";
import { search, buildNeeds } from "./routes/search";
import { exports } from "./routes/exports";
import { driveRoutes } from "./routes/drive";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "weeklog-worker" }));

// Identity probe: who am I, and am I the admin.
app.get("/api/me", requireUser, (c) => {
  const user = c.get("user");
  return c.json({ email: user.email, isAdmin: isAdmin(c.env, user) });
});

app.route("/api/members", members);
app.route("/api/requirement-templates", templates);
app.route("/api/meeting-days", meetingDays);
app.route("/api/submissions", submissions);
app.route("/api/media", media);
app.route("/api/deadlines", deadlines);
app.route("/api/dashboard", dashboard);
app.route("/api/search", search);
app.route("/api/build-needs", buildNeeds);
app.route("/api/export", exports);
app.route("/api/drive", driveRoutes);

export default app;
export type { Env } from "./bindings";
