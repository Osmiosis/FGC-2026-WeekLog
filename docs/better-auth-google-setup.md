# Better Auth + Google OAuth — Setup Checklist

**Why Google/Better Auth (no email, no rate limits):** the original Supabase magic-link
flow depended on outbound email — SPF/DKIM alignment, a mailer rate limit (~2/hour by
default), spam filtering, all outside our control (see the superseded
`docs/supabase-custom-smtp-setup.md`). Google sign-in via the Google Identity Services
(GIS) button exchanges an ID token for a session directly with our own Worker — no email
provider in the loop, no per-hour send cap, and one tap for the user. Better Auth is the
session/token layer on the Worker side: it verifies the Google ID token, creates/looks up
the user in D1, and hands back a bearer token the frontend stores and attaches to every
`/api/*` call.

**Scope:** Google Cloud Console (one-time), Worker secrets + D1 migration, frontend env
+ redeploy. No further code changes — Tasks 1–6 already wired the app for this.

---

## Prerequisite — the two origins and the callback URL

You'll register these exact strings in Google Cloud Console. Copy them verbatim:

| Purpose | Value |
|---|---|
| Worker origin (`BETTER_AUTH_URL` / `VITE_API_BASE`) | `https://weeklog-worker.fgcworker.workers.dev` |
| Frontend origin (Pages) | `https://weeklog.pages.dev` |
| Authorized JavaScript origins | `https://weeklog.pages.dev` **and** `http://localhost:5173` |
| Authorized redirect URI | `https://weeklog-worker.fgcworker.workers.dev/api/auth/callback/google` |

(Pages production branch is `main`; the local git default branch is `master` — that's a
git branch-naming detail only, it doesn't affect any URL above.)

---

## Step 1 — Google Cloud Console: create the OAuth client

1. Go to https://console.cloud.google.com and create (or select) a project, e.g.
   **Team Qatar WeekLog**.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: `Team Qatar WeekLog` (or similar), support email: your email.
   - Scopes: leave default (`.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `openid`) — no extra scopes needed.
   - Test users: add the Gmail addresses that will sign in during the demo
     (**Publishing status: Testing** is fine — no Google verification review needed for
     a small, known set of testers; unverified apps just show an "unverified app"
     interstitial the first time each tester signs in, which they click through).
   - **Important — Testing mode restricts who can sign in:** while the consent screen's
     publishing status is **Testing**, ONLY Google accounts explicitly added under
     **Audience → Test users** (up to 100) can complete sign-in — anyone else gets
     blocked at the Google consent step, even though the app UI invites "sign in with
     any Google account." Before the demo, add every reviewer's/tester's Gmail address
     as a test user, OR publish the app (**OAuth consent screen → Publishing status →
     Publish App**) to allow any Google account.
3. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `WeekLog Web`.
   - **Authorized JavaScript origins** → add both:
     - `https://weeklog.pages.dev`
     - `http://localhost:5173`
   - **Authorized redirect URIs** → add:
     - `https://weeklog-worker.fgcworker.workers.dev/api/auth/callback/google`
   - Click **Create**.
4. Copy the **Client ID** (`....apps.googleusercontent.com`) and **Client Secret**
   (`GOCSPX-...`) from the dialog (or **Credentials → your client** any time after).

---

## Step 2 — Worker: secrets + config

From the repo root (`wrangler.toml` lives there; it targets `worker/src/index.ts`):

```bash
npx wrangler secret put BETTER_AUTH_SECRET
# paste 32+ random chars, e.g. output of: openssl rand -base64 32

npx wrangler secret put GOOGLE_CLIENT_ID
# paste the Client ID from Step 1

npx wrangler secret put GOOGLE_CLIENT_SECRET
# paste the Client Secret from Step 1
```

Confirm `wrangler.toml` already has (these are non-secret and committed):

```toml
[vars]
ADMIN_EMAIL = "vibha.aarav@gmail.com"
FRONTEND_ORIGIN = "https://weeklog.pages.dev"
BETTER_AUTH_URL = "https://weeklog-worker.fgcworker.workers.dev"
DEMO_ALL_ADMIN = "true"
```

- `BETTER_AUTH_URL` is the Worker's own origin — Better Auth uses it to build the Google
  callback URL (`{BETTER_AUTH_URL}/api/auth/callback/google`), which must exactly match
  the redirect URI registered in Step 1.
- `DEMO_ALL_ADMIN = "true"` — **demo-only escape hatch**: every signed-in user is treated
  as admin, regardless of email, so any Google account you add as a test user can exercise
  admin-only routes. In a real production deploy, remove this var entirely; the app then
  falls back to single-admin gating (`ADMIN_EMAIL = vibha.aarav@gmail.com`) where only
  that account gets `isAdmin: true` from `/api/me` and everyone else gets 403 on
  `requireAdmin` routes.

---

## Step 3 — Apply the Better Auth D1 migration

Better Auth needs its own tables (user/session/account) in D1. The migration is already
written at `worker/migrations/0009_better_auth.sql`; apply it to the **remote** (production)
database:

```bash
npx wrangler d1 migrations apply weeklog --remote
```

Confirm it applied (should list `0009_better_auth.sql` as applied, not pending):

```bash
npx wrangler d1 migrations list weeklog --remote
```

---

## Step 4 — Frontend env + redeploy

In `frontend/`, create `.env` (not committed — see `frontend/.env.example` for the
template) or set the equivalent Pages project environment variables:

```
VITE_API_BASE=https://weeklog-worker.fgcworker.workers.dev
VITE_GOOGLE_CLIENT_ID=<the Client ID from Step 1>
```

Then rebuild and redeploy Pages (these are baked into the static build at build time —
see the `deploy-vite-api-base` note: a stale/missing `VITE_API_BASE` breaks the app with
an HTML-not-JSON error, so **always redeploy after changing these**):

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name weeklog
```

(Or trigger the normal Pages CI build if env vars are set in the Cloudflare Pages
dashboard under **Settings → Environment variables** for the `main`/production branch.)

---

## Step 5 — Verify

1. Open `https://weeklog.pages.dev` in a fresh/incognito window.
2. You should land on the **login wall** (`Login.tsx`) — "THE TEAM LOGBOOK" with a
   Google **Sign in with Google** button ("One tap with Google. No password, no email
   link.").
3. Click it, choose a Google test account (from Step 1), grant consent.
4. You should land inside the app, no email step, no redirect ping-pong.
5. Sign out (from the app's account/profile menu), sign back in. **Repeat sign-out /
   sign-in several times in a row** — this is the regression check for the old Supabase
   problem (magic-link rate limiting after a handful of requests/hour). The Google
   ID-token exchange has no such per-hour cap, so every attempt should succeed instantly.
6. If `DEMO_ALL_ADMIN = "true"`, confirm any signed-in test account can reach admin-only
   views (e.g. Notebook Prep generate actions); with the var unset, only
   `vibha.aarav@gmail.com` should be able to.

### If it doesn't work

- **Button doesn't render / console error about origin**: the page's exact origin isn't
  in **Authorized JavaScript origins** — re-check Step 1 (must be exact, including
  `http://` vs `https://` and no trailing slash).
- **"redirect_uri_mismatch"**: the redirect URI Better Auth builds
  (`{BETTER_AUTH_URL}/api/auth/callback/google`) doesn't exactly match what's registered
  in Google Cloud Console — check `BETTER_AUTH_URL` in `wrangler.toml` and the URI in
  Step 1 character-for-character.
- **App loads but every API call 401s right after sign-in**: `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` Worker secrets don't match the `VITE_GOOGLE_CLIENT_ID` the
  frontend was built with, or `BETTER_AUTH_SECRET` wasn't set — re-run Step 2 and
  redeploy the Worker (`npx wrangler deploy`).
- **"not configured" screen instead of the login wall**: `VITE_API_BASE` or
  `VITE_GOOGLE_CLIENT_ID` is missing from the Pages build — redo Step 4 and redeploy.
- **HTML-not-JSON error on any API call**: `VITE_API_BASE` wasn't baked into the Pages
  build (stale build) — rebuild and redeploy per the note in Step 4.
