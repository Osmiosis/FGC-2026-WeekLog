# Design Seam + Guardrails Implementation Plan

**Goal:** Let a design agent freely iterate the frontend without breaking the backend wiring.

**Approach:** Move all wiring into a protected `src/lib/` layer; make feature components purely presentational; add a verify gate + smoke test; hand off via a `design` branch and DESIGN.md.

## Protected layer (off-limits to the design agent)
```
src/lib/supabase.ts        client init + isConfigured
src/lib/api.ts             api(), apiForm(), apiBlobUrl(), downloadAuthed() (token, API_BASE)
src/lib/hooks/types.ts     shared view types
src/lib/hooks/use*.ts      one hook per feature: owns every endpoint + payload
src/auth/AuthProvider.tsx  session/role context + sendMagicLink + signOut
```
Design surface (free to rewrite): every feature component, `Login.tsx`, `App.tsx`, styles.

## Tasks
- [ ] Move `api.ts` + `supabase.ts` into `src/lib/`, add DO-NOT-EDIT headers.
- [ ] AuthProvider: add `sendMagicLink(email)` so `Login` carries no Supabase call; header.
- [ ] Create hooks: useMembers, useTemplates, useCalendar, useMeetingDay, useDashboard, useDeadlines, useBrowse, useMediaUrl. Each owns its endpoints + returns `{ data, actions }`.
- [ ] Refactor all feature components + Login + App to consume hooks/useAuth only (no fetch/url/token/supabase imports).
- [ ] Frontend test setup (vitest + jsdom + testing-library); smoke/contract tests: `api()` attaches bearer + API_BASE; a hook hits the right endpoint; App renders Login when logged out.
- [ ] Root `verify` script = typecheck + worker tests + frontend tests + build.
- [ ] `DESIGN.md` handoff; update the brief's protected-paths list.
- [ ] Verify all green; commit; create `design` branch.

## Done when
- No feature component imports `./lib/api`, `./lib/supabase`, or `@supabase/*` directly (only hooks/useAuth).
- `npm run verify` is green.
- A `design` branch exists for the agent.
