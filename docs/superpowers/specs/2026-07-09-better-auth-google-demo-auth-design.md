# Design: Better Auth (Google OAuth) for the WeekLog demo

**Date:** 2026-07-09
**Status:** Approved (design), pending implementation plan
**Author:** Brainstorming session (Claude + user)

## Context & motivation

The FGC WeekLog project was rejected in review. Reviewer feedback:

> "This project feels like not entirely fleshed out/implemented and could benefit
> from having additional features like user authentication to make this a useful tool."

The user needs **visible, working user authentication on the demo site**, and it must
be **fully free**.

### What exists today
- **Frontend:** React + Vite SPA on Cloudflare Pages (`weeklog.pages.dev`).
- **Backend:** Cloudflare Worker (Hono) on a **separate origin**, using D1 (SQLite) + R2.
- **Auth today:** Supabase magic-link (passwordless email). Runs **open-access** — anyone
  browsing is a "member"; only the admin signs in. Admin identity = Google/email matches
  `ADMIN_EMAIL` in the worker.
- **Transport:** every API call already sends `Authorization: Bearer <token>` (see
  `frontend/src/lib/api.ts`); the worker validates the token. **No cookies** — cross-origin
  by bearer header.

### Why the current setup fails the demo
1. **No visible auth.** Open-access hides the whole feature — a reviewer sees no login.
2. **Magic-link rate limits.** Supabase's built-in email sender is throttled to ~2–4
   emails/hour on the free tier. After ~one login the reviewer got "email rate limit
   exceeded" and login appeared broken. This was the user's core pain ("always got limited
   after like one login").
3. **Free-tier auto-pause.** Supabase free projects pause after ~7 days idle — a demo hit
   sporadically by reviewers can silently break.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Auth mechanism | **Google OAuth** (passwordless, one-tap) | Keeps the magic-link *feel* the user liked, but sends **zero email** → nothing to rate-limit; free forever. |
| Auth library | **Better Auth**, self-hosted in the Worker, sessions in **D1** | Removes Supabase entirely — kills the whole class of pain (rate limits, SMTP, OTP filtering, auto-pause). Stronger "fleshed out" engineering story. |
| Google flow | **ID-token flow via Google Identity Services (GIS)** — NOT the redirect flow | Frontend and worker are different origins; the redirect flow needs a third-party session cookie (fragile/blocked). ID-token flow is a plain `fetch`, returns the bearer token in a header, fits the existing bearer architecture. |
| Token transport | **Better Auth `bearer` plugin** (token in `Authorization` header) | Mirrors the existing pattern exactly; avoids cross-origin cookies. |
| Login wall | **Yes — reverse open-access.** App requires Google sign-in to enter. | Directly answers the reviewer: auth is the first thing they see and use. |
| Roles (demo) | **Every signed-in user is admin** on the demo, gated by a `DEMO_ALL_ADMIN` worker flag | Reviewer signs in with their own Google account and gets the full admin experience with no allow-listing. |
| Roles (prod) | Flag off → falls back to `ADMIN_EMAIL` check (admin) vs member | Production behavior preserved; single-config switch. |

> **Note:** This reverses the deliberate 2026-06-22 "open access / no login wall" decision.
> That is intentional and follows reviewer feedback, not a regression.

## Architecture

### Auth flow (ID-token, cookieless)
1. User lands on the **login wall**.
2. Google Identity Services renders "Sign in with Google" using `VITE_GOOGLE_CLIENT_ID`.
3. User picks an account → GIS returns a **Google ID token** (`credential`) to client JS.
4. Client calls `authClient.signIn.social({ provider: "google", idToken: { token } })`
   → one `fetch` to the worker's Better Auth handler.
5. Better Auth verifies the ID token with Google, upserts the `user`/`account`, creates a
   `session`, and returns the session token in the **`set-auth-token` response header**.
6. Client `onSuccess` stores that token in `localStorage` as the bearer token.
7. `AuthProvider` sets session; `/api/me` returns `{ email, isAdmin }`; app renders member
   or admin UI.
8. Every subsequent API call attaches `Authorization: Bearer <token>` (unchanged pattern).
9. Sign-out clears the Better Auth session + the stored token → back to the wall.

### Component responsibilities

**Worker (`worker/`)**
- `src/auth.ts` — **rewritten.** Exports `createAuth(db, env)` **factory** (built per-request
  because the D1 binding only exists inside a request). Configures:
  - `database`: `{ type: "sqlite", dialect: new D1Dialect({ database: db }) }`
  - `plugins: [bearer()]`
  - `socialProviders.google`: `{ clientId, clientSecret }`
  - `baseURL`: worker origin (`BETTER_AUTH_URL`); `trustedOrigins`: `[FRONTEND_ORIGIN]`
  - `secret`: `BETTER_AUTH_SECRET`
  - Re-implement `requireUser` / `requireAdmin` middleware using
    `auth.api.getSession({ headers: c.req.raw.headers })`. Admin =
    `env.DEMO_ALL_ADMIN === "true"` (any signed-in user is admin — the demo default) **OR**
    `session.user.email === env.ADMIN_EMAIL` (case-insensitive fallback for production).
    Anonymous = no/invalid token.
- `src/index.ts` — mount `app.on(["GET","POST"], "/api/auth/*", c => createAuth(c.env.DB,
  c.env).handler(c.req.raw))`. CORS: exact `FRONTEND_ORIGIN`, `allowHeaders: ["Content-Type",
  "Authorization"]`, **`exposeHeaders: ["set-auth-token"]`**.
- `migrations/0004_better_auth.sql` — **new.** Better Auth's `user`, `session`, `account`,
  `verification` tables. Generated via `@better-auth/cli generate` against a throwaway local
  SQLite config (the CLI cannot reach D1 directly), then pasted into a wrangler migration.
- `/api/me` route — unchanged shape `{ email, isAdmin }`, now sourced from the Better Auth
  session.

**Frontend (`frontend/src/`)**
- `lib/auth-client.ts` — **new**, replaces `lib/supabase.ts`. `createAuthClient({ baseURL:
  VITE_API_BASE, fetchOptions })` where `fetchOptions` (a) captures `set-auth-token` into
  `localStorage` on success and (b) attaches `Authorization: Bearer` from `localStorage`.
  Export an `isConfigured` boolean (both `VITE_API_BASE` and `VITE_GOOGLE_CLIENT_ID` present).
- `auth/AuthProvider.tsx` — same `useAuth()` **contract** (`session`, `email`, `isAdmin`,
  `loading`, `signOut`), backed by Better Auth's `useSession`. `sendMagicLink` is **replaced**
  by `signInWithGoogle(idToken)`.
- `lib/api.ts` — `getFreshToken()` reads the stored bearer token instead of the Supabase
  session. Downstream `Authorization: Bearer` behavior unchanged. (Token refresh: Better Auth
  session tokens are validated server-side; the client simply resends the stored token. If
  expired, the worker returns 401 and the app returns the user to the wall.)
- `auth/Login.tsx` — renders the **GIS "Sign in with Google" button** (loads
  `accounts.google.com/gsi/client`, initialized with `VITE_GOOGLE_CLIENT_ID`); on
  `credential`, calls `signInWithGoogle`. Keeps the existing Team Qatar branding/layout.
- `App.tsx` — **login wall**: when `!session` (and not loading), render `<Login />` full-screen;
  otherwise render the shell. Remove the "Admin sign in" on-demand overlay logic.

### Config & secrets (all free)
- **Google Cloud Console** (free, one-time): OAuth consent screen (External, Testing is fine
  for a demo) + **Web** OAuth client. Authorized JavaScript origins: the frontend origin
  (for GIS) and `http://localhost:5173` for dev. Authorized redirect URIs: the worker
  callback `<BETTER_AUTH_URL>/api/auth/callback/google` (kept for completeness even though the
  ID-token flow is primary).
- **Worker** (`wrangler.toml` vars + `wrangler secret put`):
  - Add: `BETTER_AUTH_URL` (worker origin), `FRONTEND_ORIGIN` (already present).
  - Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  - Keep: `ADMIN_EMAIL` (production fallback). Add `DEMO_ALL_ADMIN = "true"` on the demo
    deployment so every signed-in user is admin.
  - Remove: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
  - `compatibility_flags = ["nodejs_compat"]` (Better Auth needs Node crypto built-ins).
- **Frontend** (`.env`): `VITE_API_BASE` (worker origin), `VITE_GOOGLE_CLIENT_ID`. Remove
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Error handling
- **Not configured** (missing `VITE_API_BASE`/`VITE_GOOGLE_CLIENT_ID`): existing "Setup needed"
  screen, updated copy.
- **Google sign-in cancelled/failed**: stay on the login wall, show a retry message.
- **Expired/invalid bearer token**: worker returns 401 → client clears token → returns to wall.
- **`/api/me` transient failure while signed in**: do NOT demote admin (preserve current
  behavior in `AuthProvider`).

## Testing
- **Worker** `test/auth.test.ts` — rewritten: mock `auth.api.getSession` to return
  a signed-in user / null; assert:
  - `DEMO_ALL_ADMIN="true"` → any signed-in user is admin (200), anonymous → 401.
  - `DEMO_ALL_ADMIN` unset + `ADMIN_EMAIL` match → admin (200); non-matching signed-in user
    → member (403 on admin routes); anonymous → 401.
- **Frontend** auth smoke test — the wall renders the Google button when signed out; a mocked
  stored token + session renders the shell; admin session shows admin nav.
- **Manual acceptance** (the reviewer's scenario):
  1. Open demo → **login wall visible**.
  2. Sign in with **any** Google account → **admin experience** (all tabs, since
     `DEMO_ALL_ADMIN="true"` on the demo).
  3. Sign out; **sign in again 3–5 times in a row → no rate limit** (proves the fix).

## Deliverable docs
- `docs/better-auth-google-setup.md` — exact reproducible click-path: Google Cloud setup,
  wrangler secrets, running the D1 migration (`wrangler d1 migrations apply`), and the env
  vars for both worker and frontend.
- Mark `docs/supabase-custom-smtp-setup.md` as **superseded** (Supabase auth removed).

## Out of scope (YAGNI)
- Email/password signup, magic-link, GitHub/other providers.
- Per-user data ownership / row-level permissions beyond the existing member/admin split.
- Multi-admin. `ADMIN_EMAIL` remains a single configured admin.
- Same-origin infra migration (Pages proxy) — the ID-token flow removes the need.

## Known risks / watch-items (from research)
- **Better Auth CLI can't touch D1 directly** (`_cf_METADATA` → `SQLITE_AUTH`, and no binding
  in Node). Mitigation: generate DDL against local SQLite, hand-place into a wrangler migration.
- **D1 binding is per-request** — never instantiate `betterAuth` at module top-level; always
  via the `createAuth(c.env.DB, c.env)` factory.
- **Version drift** — Better Auth evolves fast; pin versions and re-verify the bearer/ID-token
  behavior against the installed version during implementation.
- **`set-auth-token` capture** — verified for the ID-token (non-redirect) path; the redirect
  path is intentionally NOT used.
