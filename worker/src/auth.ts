import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Env, AuthUser, Variables } from "./bindings";

// Verify a Supabase access token by asking Supabase who it belongs to.
// No JWT secret needed: the /auth/v1/user endpoint validates the token for us.
export async function getUser(env: Env, token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; email?: string };
    if (!data || !data.email) return null;
    return { id: data.id ?? "", email: data.email };
  } catch {
    return null;
  }
}

export function isAdmin(env: Env, user: AuthUser): boolean {
  return user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

// Open-access model: the logbook is public at "member" level. This middleware no
// longer blocks — it attaches the signed-in user when a valid bearer token is
// present, otherwise an anonymous member. Routes that must stay private (admin
// config) gate with requireAdmin below, which still enforces login.
const ANON: AuthUser = { id: "", email: "" };

export const requireUser = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const token = bearerToken(c);
  const user = token ? await getUser(c.env, token) : null;
  c.set("user", user ?? ANON);
  await next();
});

// Signed-in AND the configured admin email.
export const requireAdmin = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const token = bearerToken(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await getUser(c.env, token);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (!isAdmin(c.env, user)) return c.json({ error: "forbidden" }, 403);
  c.set("user", user);
  await next();
});
