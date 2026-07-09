# Better Auth Google OAuth (demo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase magic-link auth with self-hosted Better Auth (Google OAuth, bearer tokens) on the Cloudflare Worker + D1, behind a login wall, where every signed-in user is admin on the demo.

**Architecture:** Better Auth's handler mounts into the existing Hono Worker under `/api/auth/*`, backed by D1 via a Kysely dialect. Login uses Google's **ID-token** flow (Google Identity Services renders the button, returns an ID token, one `fetch` exchanges it for a session) so no third-party cookies are needed — the session token rides in the `Authorization: Bearer` header exactly like today. Supabase is removed entirely.

**Tech Stack:** Cloudflare Workers (Hono), Cloudflare D1 (SQLite), Better Auth + `bearer` plugin + Kysely (`kysely-d1`), React + Vite, Google Identity Services (`accounts.google.com/gsi/client`), Vitest.

## Global Constraints

- **No email in the login path.** Google OAuth only — nothing that sends email (this is the whole point: the old magic-link email quota was the bug). Copied verbatim from spec: "sends **zero email** → nothing to rate-limit."
- **Cross-origin bearer, never cookies.** Frontend (`weeklog.pages.dev`) and Worker are different origins. Auth token MUST travel in `Authorization: Bearer <token>`. Use the Better Auth `bearer` plugin; do NOT rely on cookies.
- **Use the Google ID-token flow, not the redirect flow.** Redirect needs a third-party callback cookie (fragile/blocked cross-origin).
- **D1 binding is per-request.** NEVER call `betterAuth({...})` at module top-level. Always build it inside the request via `createAuth(c.env.DB, c.env)`.
- **Demo role rule:** `DEMO_ALL_ADMIN === "true"` → every signed-in user is admin. Otherwise fall back to `user.email === ADMIN_EMAIL` (case-insensitive). Production behavior preserved.
- **`useAuth()` contract is frozen:** it must keep exposing `{ session, email, isAdmin, loading, signOut }`. Consumers (`App.tsx`) rely on these names. The only method change: `sendMagicLink` is removed, `signInWithGoogle(idToken: string)` is added.
- **`nodejs_compat`** must be enabled in `wrangler.toml` (Better Auth needs Node crypto built-ins).
- **Version pinning:** Better Auth evolves fast. Pin the installed version and, if any API below differs from the installed version's docs, prefer the installed version and note the deviation in the commit message.

---

### Task 1: Worker dependencies, wrangler config, and binding types

**Files:**
- Modify: `worker/package.json` (dependencies)
- Modify: `wrangler.toml:3` (compat flag) and `wrangler.toml:19-27` (vars)
- Modify: `worker/src/bindings.ts:2-15` (Env interface)

**Interfaces:**
- Produces: updated `Env` with `BETTER_AUTH_URL: string`, `BETTER_AUTH_SECRET: string`, `GOOGLE_CLIENT_ID: string`, `GOOGLE_CLIENT_SECRET: string`, `DEMO_ALL_ADMIN?: string`; removes `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Later tasks import these.

- [ ] **Step 1: Install runtime + dev dependencies**

Run (from repo root):
```bash
npm --workspace @weeklog/worker install better-auth kysely kysely-d1
npm --workspace @weeklog/worker install -D @better-auth/cli
```
(If workspaces aren't configured, `cd worker && npm install better-auth kysely kysely-d1 && npm install -D @better-auth/cli`.)

- [ ] **Step 2: Enable `nodejs_compat` and add vars in `wrangler.toml`**

Add under `compatibility_date` (line 3):
```toml
compatibility_flags = ["nodejs_compat"]
```
Replace the `[vars]` block (remove Supabase, add Better Auth + demo flag). Keep `ADMIN_EMAIL` and `FRONTEND_ORIGIN`:
```toml
[vars]
ADMIN_EMAIL = "vibha.aarav@gmail.com"
FRONTEND_ORIGIN = "https://weeklog.pages.dev"
# Better Auth base URL = this Worker's own origin (used to build the Google callback).
BETTER_AUTH_URL = "https://weeklog-worker.workers.dev"
# Demo: every signed-in user is admin. Unset/omit in a real production deploy.
DEMO_ALL_ADMIN = "true"

# Secrets (set once, never commit):
#   wrangler secret put BETTER_AUTH_SECRET   # 32+ random chars
#   wrangler secret put GOOGLE_CLIENT_ID
#   wrangler secret put GOOGLE_CLIENT_SECRET
```

- [ ] **Step 3: Update `Env` in `worker/src/bindings.ts`**

Replace lines 2-15 (the `Env` interface body) with:
```ts
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ADMIN_EMAIL: string;
  // Better Auth
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Demo: when "true", every signed-in user is treated as admin.
  DEMO_ALL_ADMIN?: string;
  // Optional Drive connector config (v1 ships the NullDriveConnector). See drive.ts.
  DRIVE_ENABLED?: string;
  DRIVE_FOLDER_ID?: string;
  // Allowed browser origin for CORS (the deployed Pages URL). Defaults to "*".
  FRONTEND_ORIGIN?: string;
  // Shared secret for the offline pipeline's write-back to /api/notebook/publish.
  NOTEBOOK_PUBLISH_SECRET?: string;
}
```

- [ ] **Step 4: Typecheck the worker**

Run: `npm --workspace @weeklog/worker run build` (or `cd worker && npx tsc --noEmit`)
Expected: FAILS — `worker/src/auth.ts` and `worker/src/index.ts` still reference `SUPABASE_URL`/`SUPABASE_ANON_KEY`. This is expected; Tasks 3 fixes them. Confirm the ONLY errors are the Supabase references in `auth.ts`/`index.ts` (no errors in `bindings.ts`).

- [ ] **Step 5: Commit**

```bash
git add worker/package.json package-lock.json wrangler.toml worker/src/bindings.ts
git commit -m "chore(auth): add Better Auth deps, nodejs_compat, and env bindings"
```

---

### Task 2: Better Auth D1 schema migration

**Files:**
- Create: `worker/migrations/0004_better_auth.sql`

**Interfaces:**
- Produces: D1 tables `user`, `session`, `account`, `verification` that Better Auth reads/writes.

- [ ] **Step 1: Generate the canonical schema from Better Auth (version-accurate)**

Better Auth's CLI cannot talk to D1 directly. Generate the DDL against a throwaway local SQLite so it emits pure `CREATE TABLE` statements:
```bash
cd worker
# Temporary generator config pointing at a local sqlite file (better-sqlite3),
# mirroring the real betterAuth options (google provider + bearer plugin).
# Then:
npx @better-auth/cli generate --output better-auth-schema.sql
```
This `better-auth-schema.sql` is the source of truth for your installed version. If it differs from the SQL in Step 2, use the generated version and note it in the commit.

- [ ] **Step 2: Create the migration file**

Create `worker/migrations/0004_better_auth.sql` (expected shape for current Better Auth SQLite; reconcile against Step 1's output):
```sql
-- Better Auth core tables (user/session/account/verification).
-- Generated via @better-auth/cli generate against local SQLite, then hand-placed
-- here because the CLI cannot reach D1 directly. Reconcile with the installed
-- Better Auth version's generated schema.

CREATE TABLE user (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  createdAt     DATE NOT NULL,
  updatedAt     DATE NOT NULL
);

CREATE TABLE session (
  id        TEXT PRIMARY KEY,
  expiresAt DATE NOT NULL,
  token     TEXT NOT NULL UNIQUE,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId    TEXT NOT NULL REFERENCES user(id)
);

CREATE TABLE account (
  id                    TEXT PRIMARY KEY,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  userId                TEXT NOT NULL REFERENCES user(id),
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  DATE,
  refreshTokenExpiresAt DATE,
  scope                 TEXT,
  password              TEXT,
  createdAt             DATE NOT NULL,
  updatedAt             DATE NOT NULL
);

CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  DATE NOT NULL,
  createdAt  DATE,
  updatedAt  DATE
);

CREATE INDEX idx_session_userId ON session(userId);
CREATE INDEX idx_account_userId ON account(userId);
```

- [ ] **Step 3: Apply the migration locally and verify the tables exist**

Run:
```bash
npx wrangler d1 migrations apply weeklog --local
npx wrangler d1 execute weeklog --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user','session','account','verification') ORDER BY name;"
```
Expected: four rows — `account`, `session`, `user`, `verification`.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0004_better_auth.sql
git commit -m "feat(auth): add Better Auth D1 schema migration"
```

---

### Task 3: Worker auth rewrite (factory, admin rule, middleware, handler mount)

**Files:**
- Rewrite: `worker/src/auth.ts`
- Modify: `worker/src/index.ts:1-38` (imports, CORS, mount `/api/auth/*`)
- Rewrite: `worker/test/auth.test.ts`

**Interfaces:**
- Consumes: `Env` from Task 1; D1 tables from Task 2.
- Produces:
  - `createAuth(db: D1Database, env: Env): Auth` — builds a per-request Better Auth instance.
  - `isAdmin(env: Env, user: AuthUser): boolean` — `DEMO_ALL_ADMIN === "true"` OR email matches `ADMIN_EMAIL`.
  - `requireUser` / `requireAdmin` Hono middleware (same names as today) that read the session via the bearer token.

- [ ] **Step 1: Write the failing test — `worker/test/auth.test.ts`**

Replace the file with tests that mock `createAuth().api.getSession`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the auth factory so tests don't need a real DB / Google.
const getSession = vi.fn();
vi.mock("../src/auth", async (orig) => {
  const actual = await orig<typeof import("../src/auth")>();
  return {
    ...actual,
    createAuth: () => ({ api: { getSession }, handler: async () => new Response(null) }),
  };
});

import app from "../src/index";
import type { Env } from "../src/bindings";

const baseEnv = {
  ADMIN_EMAIL: "admin@example.com",
  BETTER_AUTH_URL: "https://w.example.com",
  BETTER_AUTH_SECRET: "x".repeat(32),
  GOOGLE_CLIENT_ID: "gid",
  GOOGLE_CLIENT_SECRET: "gsecret",
} as unknown as Env;

beforeEach(() => getSession.mockReset());

describe("auth + /api/me", () => {
  it("anonymous (no session) → email empty, not admin", async () => {
    getSession.mockResolvedValue(null);
    const res = await app.request("/api/me", {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "", isAdmin: false });
  });

  it("DEMO_ALL_ADMIN makes any signed-in user admin", async () => {
    getSession.mockResolvedValue({ user: { id: "1", email: "kid@example.com" } });
    const env = { ...baseEnv, DEMO_ALL_ADMIN: "true" };
    const res = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, env);
    expect(await res.json()).toEqual({ email: "kid@example.com", isAdmin: true });
  });

  it("without DEMO flag, only ADMIN_EMAIL is admin", async () => {
    getSession.mockResolvedValue({ user: { id: "1", email: "kid@example.com" } });
    const res = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, baseEnv);
    expect(await res.json()).toEqual({ email: "kid@example.com", isAdmin: false });

    getSession.mockResolvedValue({ user: { id: "2", email: "admin@example.com" } });
    const res2 = await app.request("/api/me", { headers: { Authorization: "Bearer t" } }, baseEnv);
    expect(await res2.json()).toEqual({ email: "admin@example.com", isAdmin: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --workspace @weeklog/worker test -- auth.test.ts`
Expected: FAIL (auth.ts still Supabase-based; `createAuth` doesn't exist).

- [ ] **Step 3: Rewrite `worker/src/auth.ts`**

```ts
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { D1Dialect } from "kysely-d1";
import type { Env, AuthUser, Variables } from "./bindings";

// Per-request factory: the D1 binding only exists inside a request, so we must
// NOT construct betterAuth at module scope.
export function createAuth(db: D1Database, env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    database: { type: "sqlite", dialect: new D1Dialect({ database: db }) },
    trustedOrigins: [env.FRONTEND_ORIGIN ?? "*"],
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

// Demo: every signed-in user is admin. Otherwise fall back to the configured admin.
export function isAdmin(env: Env, user: AuthUser): boolean {
  if (!user.email) return false;
  if (env.DEMO_ALL_ADMIN === "true") return true;
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
    if (!isAdmin(c.env, user)) return c.json({ error: "forbidden" }, 403);
    c.set("user", user);
    await next();
  }
);
```

- [ ] **Step 4: Mount the Better Auth handler + expose the token header in `worker/src/index.ts`**

Change the import on line 4 to also pull `createAuth`:
```ts
import { requireUser, isAdmin, createAuth } from "./auth";
```
Replace the CORS block (lines 23-30) with (adds `set-auth-token` to exposed headers):
```ts
app.use(
  "/api/*",
  cors({
    origin: (_origin, c) => c.env?.FRONTEND_ORIGIN ?? "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["set-auth-token"],
  })
);

// Better Auth handles all /api/auth/* routes (Google sign-in, session, sign-out).
app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env.DB, c.env).handler(c.req.raw));
```
(The existing `/api/me` route on lines 35-38 stays exactly as-is — its shape is unchanged.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --workspace @weeklog/worker test -- auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck the whole worker**

Run: `npm --workspace @weeklog/worker run build`
Expected: PASS — no more Supabase references.

- [ ] **Step 7: Commit**

```bash
git add worker/src/auth.ts worker/src/index.ts worker/test/auth.test.ts
git commit -m "feat(auth): Better Auth session middleware, demo-all-admin, /api/auth mount"
```

---

### Task 4: Frontend auth client (bearer capture + attach)

**Files:**
- Create: `frontend/src/lib/auth-client.ts`
- Delete: `frontend/src/lib/supabase.ts`
- Modify: `frontend/package.json` (remove `@supabase/supabase-js`, add `better-auth`)
- Test: `frontend/src/lib/auth-client.test.ts`

**Interfaces:**
- Produces:
  - `authClient` — Better Auth React client pointed at the Worker origin.
  - `isConfigured: boolean` — true when `VITE_API_BASE` and `VITE_GOOGLE_CLIENT_ID` are set.
  - `getStoredToken(): string | null` and the localStorage key `weeklog_bearer` (consumed by `api.ts` in Task 5).

- [ ] **Step 1: Install/remove deps**

```bash
npm --workspace frontend install better-auth
npm --workspace frontend uninstall @supabase/supabase-js
```

- [ ] **Step 2: Write the failing test — `frontend/src/lib/auth-client.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { storeToken, getStoredToken, clearToken, TOKEN_KEY } from "./auth-client";

describe("bearer token storage", () => {
  beforeEach(() => localStorage.clear());

  it("stores and reads the bearer token", () => {
    storeToken("abc123");
    expect(getStoredToken()).toBe("abc123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc123");
  });

  it("clears the token", () => {
    storeToken("abc123");
    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm --workspace frontend test -- auth-client.test.ts`
Expected: FAIL ("Cannot find module './auth-client'").

- [ ] **Step 4: Create `frontend/src/lib/auth-client.ts`**

```ts
// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — connects the app to Better Auth (Google, bearer tokens).
// Build UI on top of useAuth() / the hooks in src/lib/hooks.
// ─────────────────────────────────────────────────────────────────────────────
import { createAuthClient } from "better-auth/react";

const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const isConfigured = Boolean(apiBase && googleClientId);
export const GOOGLE_CLIENT_ID = googleClientId ?? "";
export const TOKEN_KEY = "weeklog_bearer";

export const storeToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const authClient = createAuthClient({
  baseURL: apiBase ?? "",
  fetchOptions: {
    // Capture the session token Better Auth returns after any auth call.
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) storeToken(token);
    },
    // Attach it as Authorization: Bearer on the client's own requests.
    auth: { type: "Bearer", token: () => getStoredToken() ?? "" },
  },
});
```

- [ ] **Step 5: Delete the old Supabase client**

```bash
git rm frontend/src/lib/supabase.ts
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm --workspace frontend test -- auth-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/auth-client.ts frontend/src/lib/auth-client.test.ts frontend/package.json package-lock.json
git commit -m "feat(auth): Better Auth react client with bearer token storage"
```

---

### Task 5: AuthProvider + api.ts on Better Auth

**Files:**
- Rewrite: `frontend/src/auth/AuthProvider.tsx`
- Modify: `frontend/src/lib/api.ts:7`, `:14-25` (`getFreshToken`)

**Interfaces:**
- Consumes: `authClient`, `getStoredToken`, `clearToken` from Task 4.
- Produces: `useAuth()` returning `{ session, email, isAdmin, loading, signOut, signInWithGoogle }` where `signInWithGoogle(idToken: string): Promise<{ error: string | null }>`. Consumed by `Login.tsx` (Task 6) and `App.tsx` (Task 6).

- [ ] **Step 1: Rewrite `frontend/src/auth/AuthProvider.tsx`**

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — owns the auth session and role. Build login/role UI on
// top of useAuth(). Backed by Better Auth (Google, bearer tokens).
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient, clearToken, getStoredToken } from "../lib/auth-client";
import { api } from "../lib/api";

interface AuthState {
  session: boolean;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  // Exchange a Google ID token for a Better Auth session.
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  const signedIn = Boolean(data?.user?.email) && Boolean(getStoredToken());

  useEffect(() => {
    if (!signedIn) {
      setIsAdmin(false);
      return;
    }
    // Only trust a successful response; a transient failure must not demote.
    api<{ email: string; isAdmin: boolean }>("/api/me")
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => {});
  }, [signedIn]);

  const signOut = async () => {
    await authClient.signOut().catch(() => {});
    clearToken();
  };

  const signInWithGoogle = async (idToken: string) => {
    const { error } = await authClient.signIn.social({
      provider: "google",
      idToken: { token: idToken },
    });
    return { error: error ? (error.message ?? "Sign-in failed") : null };
  };

  return (
    <Ctx.Provider
      value={{
        session: signedIn,
        email: data?.user?.email ?? null,
        isAdmin,
        loading: isPending,
        signOut,
        signInWithGoogle,
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
```
> Note: `session` changes from a Supabase `Session` object to a `boolean` (signed-in or not). `App.tsx` only uses it for truthiness, so this is compatible — confirmed in Task 6.

- [ ] **Step 2: Update `getFreshToken` in `frontend/src/lib/api.ts`**

Replace the import on line 7:
```ts
import { getStoredToken } from "./auth-client";
```
Replace `getFreshToken` (lines 13-25) with:
```ts
// Return the stored bearer token, if any. Better Auth validates it server-side;
// an expired token yields a 401 and the app returns the user to the login wall.
async function getFreshToken(): Promise<string | null> {
  return getStoredToken();
}
```

- [ ] **Step 3: Typecheck + run the existing frontend tests**

Run: `npm --workspace frontend test`
Expected: existing non-auth tests PASS. `App.smoke.test.tsx` will be updated in Task 6 — if it fails now on the Supabase mock, that's expected and fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/auth/AuthProvider.tsx frontend/src/lib/api.ts
git commit -m "feat(auth): back AuthProvider and api token with Better Auth"
```

---

### Task 6: Login wall (GIS button) + App gating

**Files:**
- Rewrite: `frontend/src/auth/Login.tsx`
- Modify: `frontend/src/App.tsx:1-3`, `:42-57`, `:83-95`, `:139-151`, `:177-191`
- Modify: `frontend/src/App.smoke.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`session`, `loading`, `signInWithGoogle`) and `isConfigured`, `GOOGLE_CLIENT_ID` from Task 4.

- [ ] **Step 1: Rewrite `frontend/src/auth/Login.tsx` to render the Google button**

```tsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { GOOGLE_CLIENT_ID } from "../lib/auth-client";

// Passwordless Google sign-in via Google Identity Services (ID-token flow).
// GIS renders its own button; on credential we exchange the ID token for a
// Better Auth session. No email, no redirect, no rate limits.
declare global {
  interface Window {
    google?: any;
  }
}

export function Login() {
  const { signInWithGoogle } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return setError("No credential from Google.");
          const { error } = await signInWithGoogle(resp.credential);
          if (error) setError(error);
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [signInWithGoogle]);

  return (
    <div className="tq" style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 46, borderLeft: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="rail-label" style={{ letterSpacing: ".4em" }}>LOG · TRACK · REPORT · WIN</div>
      </div>
      <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "8vh 28px 6vh", paddingRight: 74 }}>
        <div className="serration" style={{ width: 120, marginBottom: 30 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <img src="/team-qatar-logo.png" className="logo-badge" style={{ width: 54, height: 54 }} alt="Team Qatar" />
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap" }}>TEAM QATAR</div>
            <div className="mono-label" style={{ fontSize: 10 }}>FGC 2026</div>
          </div>
        </div>
        <p className="eyebrow" style={{ marginBottom: 18 }}><span className="dot">/ </span>Meeting compliance &amp; documentation</p>
        <h1 className="display" style={{ fontSize: "clamp(40px, 9vw, 68px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-0.02em" }}>
          THE TEAM<br /><span style={{ color: "var(--maroon-bright)" }}>LOGBOOK</span>
        </h1>
        <p style={{ color: "var(--fg-dim)", fontSize: 16, marginTop: 18, maxWidth: 400 }}>
          Every meeting, every deadline, one red, amber, green view of how your documentation is doing.
        </p>
        <div style={{ marginTop: 40 }} ref={btnRef} />
        {error && <p style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</p>}
        <p className="mono-label" style={{ fontSize: 10, marginTop: 14, color: "var(--fg-faint)", lineHeight: 1.6 }}>
          One tap with Google. No password, no email link.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Gate the app on session in `frontend/src/App.tsx`**

Change imports (lines 1-3) — drop `isConfigured` from supabase, import from auth-client:
```tsx
import { useState } from "react";
import { isConfigured } from "./lib/auth-client";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Login } from "./auth/Login";
```
In `Shell()` (line 43) drop the now-unused `showLogin` state (line 48) and replace the loading/wall block (lines 53-56) with:
```tsx
  if (loading) return <div className="tq" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><p className="mono-label">Loading...</p></div>;
  // Login wall: must sign in with Google to enter.
  if (!session) return <Login />;
```
Remove the desktop "Admin sign in" fallback button (lines 93-95, the `) : (` … `<button ... onClick={() => setShowLogin(true)}>Admin sign in</button>`), so that block always renders the signed-in user footer. Do the same for the mobile sheet fallback (lines 148-150). Since every signed-in user is admin on the demo, the `isAdmin`-gated nav and footer render as admin.

Concretely, the desktop footer (lines 83-96) becomes just the signed-in block:
```tsx
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 50, background: "var(--maroon)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--disp)", fontWeight: 700, fontSize: 13, flex: "none" }}>{(email ?? "?").slice(0, 2).toUpperCase()}</div>
              <div style={{ lineHeight: 1.2, overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                <div className="mono-label" style={{ fontSize: 9 }}>{isAdmin ? "Admin" : "Member"}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: 34, padding: 0, justifyContent: "center" }} onClick={signOut} title="Sign out"><Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} /></button>
            </div>
          </div>
```
And the mobile sheet footer (lines 139-151) becomes just:
```tsx
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                <div className="mono-label" style={{ fontSize: 9 }}>{isAdmin ? "Admin" : "Member"}</div>
              </div>
              <button className="btn btn-sm" onClick={signOut}>Sign out</button>
            </div>
```
Update the setup-needed copy (lines 177-185): replace the Supabase message with:
```tsx
        <p style={{ color: "var(--fg-dim)" }}>Auth is not configured. Set VITE_API_BASE (the Worker URL) and VITE_GOOGLE_CLIENT_ID in frontend/.env, then restart the dev server.</p>
```

- [ ] **Step 3: Update `frontend/src/App.smoke.test.tsx`**

Mock the auth client so the smoke test renders the wall (signed-out) and the shell (signed-in). Replace the Supabase mock with:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useSession = vi.fn();
vi.mock("./lib/auth-client", () => ({
  isConfigured: true,
  GOOGLE_CLIENT_ID: "gid",
  getStoredToken: () => "tok",
  clearToken: vi.fn(),
  storeToken: vi.fn(),
  authClient: {
    useSession: () => useSession(),
    signOut: vi.fn().mockResolvedValue({}),
    signIn: { social: vi.fn().mockResolvedValue({ error: null }) },
  },
}));
vi.mock("./lib/api", () => ({ api: vi.fn().mockResolvedValue({ email: "u@x.com", isAdmin: true }) }));

import App from "./App";

describe("App auth gating", () => {
  it("shows the login wall when signed out", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<App />);
    expect(screen.getByText(/THE TEAM/i)).toBeTruthy();
  });
});
```
> Keep whatever additional smoke assertions already exist that don't depend on Supabase.

- [ ] **Step 4: Run the frontend tests**

Run: `npm --workspace frontend test`
Expected: PASS (auth-client, smoke, and existing suites).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/Login.tsx frontend/src/App.tsx frontend/src/App.smoke.test.tsx
git commit -m "feat(auth): Google login wall (GIS) and app gating"
```

---

### Task 7: Setup docs, env samples, and Supabase teardown

**Files:**
- Create: `docs/better-auth-google-setup.md`
- Modify: `docs/supabase-custom-smtp-setup.md` (mark superseded)
- Modify: `frontend/.env.example` (create if absent)

**Interfaces:** none (documentation + config).

- [ ] **Step 1: Write `docs/better-auth-google-setup.md`**

Include, as concrete steps: (1) Google Cloud Console — create project, OAuth consent screen (External/Testing), Web OAuth client; **Authorized JavaScript origins** = `https://weeklog.pages.dev` and `http://localhost:5173`; **Authorized redirect URIs** = `https://weeklog-worker.workers.dev/api/auth/callback/google`. (2) Copy Client ID/Secret. (3) Worker secrets: `wrangler secret put BETTER_AUTH_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET`; confirm `DEMO_ALL_ADMIN="true"` and `BETTER_AUTH_URL` in `wrangler.toml`. (4) Apply migration: `wrangler d1 migrations apply weeklog --remote`. (5) Frontend env: `VITE_API_BASE`, `VITE_GOOGLE_CLIENT_ID`. (6) Verify: open the site → login wall → sign in with Google → repeat sign-out/sign-in several times (no rate limit).

- [ ] **Step 2: Mark the Supabase doc superseded**

Prepend to `docs/supabase-custom-smtp-setup.md`:
```markdown
> **SUPERSEDED (2026-07-09):** Supabase auth was removed. The app now uses Better
> Auth + Google OAuth. See `docs/better-auth-google-setup.md`. Kept for history only.
```

- [ ] **Step 3: Create `frontend/.env.example`**

```
VITE_API_BASE=https://weeklog-worker.workers.dev
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

- [ ] **Step 4: Commit**

```bash
git add docs/better-auth-google-setup.md docs/supabase-custom-smtp-setup.md frontend/.env.example
git commit -m "docs(auth): Better Auth + Google setup guide; supersede Supabase SMTP doc"
```

---

## Self-Review

**Spec coverage:**
- Google OAuth, Better Auth, D1, bearer, ID-token flow → Tasks 3, 4, 6. ✓
- Login wall → Task 6. ✓
- Demo-all-admin (`DEMO_ALL_ADMIN`) + prod fallback → Tasks 1, 3 (+ tests). ✓
- Supabase removal → Tasks 1 (bindings/vars), 4 (client delete + dep), 7 (doc). ✓
- `wrangler.toml` `nodejs_compat` + secrets → Task 1, 7. ✓
- D1 migration (generate-then-place) → Task 2. ✓
- `useAuth()` contract preserved (minus `sendMagicLink`, plus `signInWithGoogle`) → Task 5. ✓
- Error handling (not-configured screen, sign-in failure, 401 → wall, no-demote) → Tasks 5, 6. ✓
- Tests (worker auth, frontend token, smoke) → Tasks 3, 4, 6. ✓
- Setup doc + supersede Supabase doc → Task 7. ✓

**Placeholder scan:** No TBD/TODO. The one deliberate "reconcile against generated schema" note (Task 2) is a version-accuracy instruction with concrete fallback SQL provided, not a placeholder.

**Type consistency:** `createAuth(db, env)`, `isAdmin(env, user)`, `requireUser`/`requireAdmin` names match across Tasks 3 and their tests. `signInWithGoogle(idToken: string)` defined in Task 5, consumed in Task 6. `getStoredToken`/`clearToken`/`storeToken`/`TOKEN_KEY`/`isConfigured`/`GOOGLE_CLIENT_ID` defined in Task 4, consumed in Tasks 5, 6. `session` as boolean noted in Task 5 and relied on only for truthiness in Task 6. ✓
