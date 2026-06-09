# Frontend Design Brief & Guardrails (for Claude design / any UI designer)

You are restyling the frontend of a meeting-compliance tracker for a teenage robotics
team (Team Qatar, FIRST Global Challenge 2026). The app currently works end to end. Your
job is **visual and presentational only**. Do not change how data flows or how auth works.

## Product context (so the design serves the job)
- The spine of the app is a CALENDAR that creates OBLIGATIONS, surfaced as a
  **red / amber / green (RAG) compliance dashboard**. RAG status is the core visual
  language of this product. Design a clear, accessible RAG system (color + icon + text,
  not color alone).
- Primary users are non-technical teenagers on **phones**. Mobile-first. Big tap targets.
- Brand: Team Qatar. Qatar's national color is maroon (suggested accent, not mandatory).
- **No em dashes** anywhere in UI copy (hard project rule). Use commas, parentheses, periods.

## Tech constraints (do not break these)
- Stack stays: **React + Vite + TypeScript**, deployed as a **static SPA on Cloudflare
  Pages (free tier)**. Do NOT migrate to Next.js SSR, React Server Components, or anything
  needing a Node server. Client-rendered only.
- Keep `@supabase/supabase-js` for auth.
- You MAY introduce a styling system (Tailwind, CSS modules, vanilla-extract, plain CSS,
  etc.) and a component library, as long as it builds with `npm run build` and stays static.
- Do not add paid services or new backend dependencies.

## ALLOWED — you can freely change
- Any JSX markup, layout, CSS, styling, theming, fonts, colors, spacing, icons, animation.
- Replace the current inline `style={{...}}` objects with a real styling approach.
- Restructure components and add new presentational components, **as long as they still
  call the existing data layer** (`api()` and `useAuth()`) with the same arguments.
- Add loading, empty, error, and success states; toasts; skeletons. (The data hooks already
  expose `loading` and throw on error; wire your states to those.)
- Improve the login screen, the app shell/header, the admin Members table, and the admin
  Requirements table. Make them look good and work one-handed on a phone.
- Establish reusable primitives (Button, Input, Card, Table, Badge, RAG status pill) that
  later phases (calendar, dashboard, search) will reuse. Building this foundation well is
  the highest-value thing you can do.

## OFF LIMITS — must remain intact (this is the wiring; breaking it breaks the app)
Do not modify the behavior, signatures, or contracts of these. Restyling the components
that USE them is fine; changing what they send/expect is not.

1. `frontend/src/supabase.ts` — Supabase client init. Keep the env var names
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and the `isConfigured` guard.
2. `frontend/src/api.ts` — the `api(path, init)` fetch wrapper. It MUST keep attaching the
   Supabase access token as `Authorization: Bearer <token>` and `Content-Type: application/json`.
   All network calls must go through this helper. Do not hardcode tokens or change header logic.
3. `frontend/src/auth/AuthProvider.tsx` — keep the `useAuth()` return contract:
   `{ session, email, isAdmin, loading, signOut }`, the `onAuthStateChange` subscription,
   and the `GET /api/me` call that sets `isAdmin`. You may restyle nothing here (no UI), but
   do not change the hook shape that screens depend on.
4. `frontend/src/auth/Login.tsx` — you may fully restyle it, but it MUST keep calling
   `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`.
   The `emailRedirectTo` option is required for the magic link to return to the app. Do not
   remove it or hardcode a different URL.
5. `frontend/vite.config.ts` — keep the `/api` -> `http://localhost:8787` dev proxy.
6. **API endpoint paths and payload shapes** (the worker enforces these; the UI must match):
   - `GET /api/me` -> `{ email, isAdmin }`
   - `GET /api/members` (optional `?active=1`); `POST /api/members` `{ name, committee }`;
     `PATCH /api/members/:id` `{ name?, committee?, active? }`; `DELETE /api/members/:id`
     (soft) or `?hard=true` (hard).
   - `GET /api/requirement-templates` (optional `?active=1`);
     `POST /api/requirement-templates` `{ label, description?, compulsory, expected_kind }`;
     `POST /api/requirement-templates/reorder` `{ ids: string[] }`;
     `PATCH /api/requirement-templates/:id` (any field); `DELETE /api/requirement-templates/:id`
     (soft) or `?hard=true`.
7. **Field names are snake_case from the database** (`expected_kind`, `sort_order`,
   `compulsory`, `active`, `committee`). Use them verbatim in request bodies and when reading
   responses. Do not rename to camelCase in payloads.
8. Admin-only gating: Members and Requirements managers render only when `isAdmin` is true.
   Keep that gate. Non-admins (`member`) currently see a placeholder; you may restyle the
   placeholder but keep the role gate.

## Do not touch these directories at all
- `worker/` (the API), `types/` (shared types), `migrations`/`seed`, `wrangler.toml`,
  `.env` / `.dev.vars` and their examples, anything outside `frontend/`.

## Definition of done
- `npm run build` (in repo root or `frontend/`) succeeds.
- `npm run typecheck --workspace @weeklog/frontend` passes.
- Login still sends a magic link and returns to the app; after login the header shows the
  email and role; admin can still list/add/edit/deactivate members and add/edit/toggle/
  reorder requirement templates. All via the unchanged `api()` calls.
- Looks good and is fully usable on a 375px-wide phone screen.
- No em dashes in any copy.
