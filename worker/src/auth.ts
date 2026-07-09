import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { D1Dialect } from "kysely-d1";
import type { Env, AuthUser, Variables } from "./bindings";

// Allowed frontend origins (comma-separated FRONTEND_ORIGIN) for CORS + Better
// Auth trustedOrigins. Falls back to the local dev origin.
export function frontendOrigins(env: Env | undefined): string[] {
  return (env?.FRONTEND_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Per-request factory: the D1 binding only exists inside a request, so we must
// NOT construct betterAuth at module scope.
export function createAuth(db: D1Database, env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    database: { type: "sqlite", dialect: new D1Dialect({ database: db }) },
    trustedOrigins: frontendOrigins(env),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [bearer()],
  });
}
export type Auth = ReturnType<typeof createAuth>;

// Admin rule, evaluated per request:
//  - DEMO_ALL_ADMIN === "true"      → every signed-in user is admin (all origins)
//  - request origin === DEMO_ORIGIN → every signed-in user is admin (the demo site)
//  - otherwise                      → only ADMIN_EMAIL is admin (the main site)
export function isAdmin(env: Env, user: AuthUser, origin?: string | null): boolean {
  if (!user.email) return false;
  if (env.DEMO_ALL_ADMIN === "true") return true;
  if (origin && env.DEMO_ORIGIN && origin === env.DEMO_ORIGIN) return true;
  return user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}

const ANON: AuthUser = { id: "", email: "" };

async function sessionUser(c: Context): Promise<AuthUser | null> {
  const auth = createAuth(c.env.DB, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.email) return null;
  return { id: session.user.id ?? "", email: session.user.email };
}

// Attaches the signed-in user (or anonymous) — never blocks.
export const requireUser = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    c.set("user", (await sessionUser(c)) ?? ANON);
    await next();
  }
);

// Signed-in AND admin (per isAdmin rule).
export const requireAdmin = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const user = await sessionUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    if (!isAdmin(c.env, user, c.req.header("origin"))) return c.json({ error: "forbidden" }, 403);
    c.set("user", user);
    await next();
  }
);
