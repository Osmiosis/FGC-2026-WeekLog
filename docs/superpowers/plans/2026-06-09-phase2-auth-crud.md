# Phase 2: Auth + Members CRUD + Templates CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Supabase magic-link login, Worker-side token verification, and admin-gated CRUD for `members` and `requirement_templates`.

**Architecture:** Frontend uses `@supabase/supabase-js` for the passwordless email flow and holds the session; every API call sends `Authorization: Bearer <access_token>`. The Worker verifies the token by calling Supabase `GET /auth/v1/user` (no JWT secret needed), derives the email, and gates admin actions by `email === ADMIN_EMAIL`. Roster `members` stays separate from login identity. Worker route logic is tested with Vitest using a thin better-sqlite3 -> D1 shim and a stubbed `fetch` for auth.

**Tech Stack:** Hono, Cloudflare D1, Supabase Auth (magic link), React + Vite, Vitest, better-sqlite3 (test shim).

**Auth model (per project decision, overrides PRD passwords):**
- Magic link via Supabase. Open signup (anyone with a valid email = member).
- Single admin: `ADMIN_EMAIL` (default `vibha.aarav@gmail.com`).
- Verify by calling Supabase `/auth/v1/user` with `Authorization: Bearer <token>` + `apikey: <anon>`.

---

## File Structure

```
worker/src/
  index.ts            # wire middleware + routes (UPDATE: Env, remove password hashes)
  auth.ts             # requireUser + requireAdmin middleware, getUser()
  routes/members.ts   # GET (authed) / POST PATCH DELETE (admin)
  routes/templates.ts # GET (authed) / POST PATCH DELETE + reorder (admin)
worker/test/
  helpers/d1.ts       # better-sqlite3 -> D1 interface shim + seeded test DB factory
  auth.test.ts        # token verification + admin gating
  members.test.ts     # members CRUD
  templates.test.ts   # templates CRUD + reorder

frontend/src/
  supabase.ts         # client from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
  api.ts              # fetch wrapper attaching the bearer token
  auth/AuthProvider.tsx  # session context + useAuth()
  auth/Login.tsx      # email -> magic link
  App.tsx             # shell: login gate, me banner, admin tabs (UPDATE)
  admin/MembersAdmin.tsx
  admin/TemplatesAdmin.tsx
frontend/.env.example # committed; VITE_SUPABASE_URL + anon placeholder

ROOT (UPDATE): wrangler.toml [vars], .dev.vars.example, .gitignore (.env), README.md
```

---

## Task 1: Worker Env + config cleanup

- [ ] Update `worker/src/index.ts` Env: remove `TEAM_PASSWORD_HASH`/`ADMIN_PASSWORD_HASH`; add `SUPABASE_URL: string`, `SUPABASE_ANON_KEY: string`, `ADMIN_EMAIL: string`.
- [ ] Update `wrangler.toml`: add `[vars]` with `SUPABASE_URL`, `ADMIN_EMAIL`; document `SUPABASE_ANON_KEY` in `.dev.vars` for local + as a var/secret for deploy. Remove the password-hash secret comments.
- [ ] Add `.dev.vars.example` (SUPABASE_ANON_KEY=...).
- [ ] Add `.env` to `.gitignore`.
- [ ] Commit.

## Task 2: D1 test shim + auth middleware (TDD)

- [ ] `worker/test/helpers/d1.ts`: wrap better-sqlite3 to expose `prepare(sql).bind(...).all()/first()/run()` (async), and a `makeTestDb()` that applies `0001_init.sql` + `0002_seed.sql` + `roster.sql`.
- [ ] Write `worker/test/auth.test.ts` (fails first): unauth -> 401 on `/api/me`; stubbed fetch returns admin email -> `{ isAdmin: true }`; member email -> `{ isAdmin: false }`.
- [ ] Implement `worker/src/auth.ts`:
  - `getUser(env, token)`: `fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } })` -> on 200 return `{ email }` else null.
  - `requireUser`: read bearer, call getUser, 401 if missing/invalid, else `c.set('user', user)`.
  - `requireAdmin`: requireUser then `user.email === env.ADMIN_EMAIL` else 403.
- [ ] Add `GET /api/me` (requireUser) -> `{ email, isAdmin }`.
- [ ] Tests pass. Commit.

## Task 3: Members CRUD (TDD)

- [ ] Write `worker/test/members.test.ts` (fails first): list returns seeded roster; member token cannot POST (403); admin POST creates; admin PATCH edits; admin DELETE soft-deactivates (active=0); `?hard=true` removes the row.
- [ ] Implement `worker/src/routes/members.ts`:
  - `GET /api/members` (requireUser): `SELECT * FROM members ORDER BY committee, name`. `?active=1` filter optional.
  - `POST /api/members` (requireAdmin): body `{ name, committee }`, id = crypto.randomUUID(), active=1.
  - `PATCH /api/members/:id` (requireAdmin): name/committee/active.
  - `DELETE /api/members/:id` (requireAdmin): soft set active=0; `?hard=true` -> `DELETE`.
- [ ] Mount in `index.ts`. Tests pass. Commit.

## Task 4: Templates CRUD + reorder (TDD)

- [ ] Write `worker/test/templates.test.ts` (fails first): list returns 9 seeded; admin POST adds; PATCH toggles compulsory + edits label/description/expected_kind/active; DELETE deactivates (active=0, soft); reorder updates sort_order from an ordered id array; member is 403 on mutations.
- [ ] Implement `worker/src/routes/templates.ts`:
  - `GET /api/requirement-templates` (requireUser): `ORDER BY sort_order`. `?active=1` optional.
  - `POST` (requireAdmin): `{ label, description, compulsory, expected_kind }`, sort_order = max+1.
  - `PATCH /:id` (requireAdmin): any of label/description/compulsory/expected_kind/active/sort_order.
  - `POST /api/requirement-templates/reorder` (requireAdmin): `{ ids: string[] }` -> set sort_order by index (1-based).
  - `DELETE /:id` (requireAdmin): soft active=0; `?hard=true` hard delete.
- [ ] Mount in `index.ts`. Tests pass. Commit.

## Task 5: Frontend auth (login + session)

- [ ] `npm i @supabase/supabase-js -w @weeklog/frontend`.
- [ ] `frontend/.env.example`: `VITE_SUPABASE_URL=https://euzvqdnonmkechsdtryr.supabase.co` + `VITE_SUPABASE_ANON_KEY=` (placeholder).
- [ ] `frontend/src/supabase.ts`: create client; if env missing, export a flag so UI shows a clear "not configured" message instead of crashing.
- [ ] `frontend/src/api.ts`: `api(path, init)` attaches bearer from current session, JSON helpers.
- [ ] `frontend/src/auth/AuthProvider.tsx`: subscribe to `supabase.auth.onAuthStateChange`, expose `{ session, user, isAdmin, loading, signOut }`; fetch `/api/me` for isAdmin.
- [ ] `frontend/src/auth/Login.tsx`: email input -> `signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`; "check your email" state.
- [ ] Tests: typecheck + build (no component unit tests this phase).

## Task 6: Frontend admin screens

- [ ] `frontend/src/admin/MembersAdmin.tsx`: table of members; add row (name + committee select); inline edit; deactivate/reactivate. Admin only.
- [ ] `frontend/src/admin/TemplatesAdmin.tsx`: list ordered by sort_order; add; edit label/description/expected_kind; toggle compulsory; activate/deactivate; move up/down (calls reorder). Admin only.
- [ ] Update `frontend/src/App.tsx`: wrap in AuthProvider; if no session -> Login; else shell showing "Signed in as {email} ({admin|member})", Sign out, and (admin) tabs for Members + Templates. No em dashes in copy.
- [ ] Typecheck + build. Commit.

## Task 7: Config + README + verification gate

- [ ] Update `README.md`: replace password-secret steps with Supabase setup (create project or reuse, copy URL + anon key, set `frontend/.env` and `.dev.vars`, add `http://localhost:5173` redirect URL, note free-tier email limits), and `ADMIN_EMAIL`.
- [ ] Run `npm test` (all worker tests), `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. All green.
- [ ] Final commit.

## Self-Review
- Auth (magic link, verify, admin gate) -> Tasks 2, 5. Members CRUD -> Task 3, 6. Templates CRUD incl reorder/toggle compulsory -> Task 4, 6. Admin-only enforcement -> requireAdmin on every mutation. Config/docs -> Tasks 1, 7.
- Type consistency: Env fields (SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL) identical across index.ts, auth.ts, wrangler.toml, README. `expected_kind`/`compulsory`/`sort_order` column names match Phase 1 schema + shared types.
