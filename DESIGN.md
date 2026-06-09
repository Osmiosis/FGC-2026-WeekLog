# Design Handoff

This app is functionally complete. Your job is the **visual design only**: make it look
good and work well on a phone. The data, auth, and API wiring are isolated so you can
iterate freely without breaking anything.

Read `docs/frontend-design-brief.md` first — it covers the product, the red/amber/green
status system that is the heart of the UI, and the no-em-dashes copy rule.

## Workflow

1. Work on the `design` branch (not `main`).
2. Iterate on the presentational layer (see below). Restyle, restructure components, add a
   styling system / design tokens / component primitives — whatever you need.
3. Before saying you are done, run:

   ```
   npm run verify
   ```

   This runs typecheck + tests + build for the whole repo. **Green means you did not break
   the wiring.** If it is red, fix it before continuing.

4. To see it live: `npx wrangler dev` (API) and `npm run dev --workspace @weeklog/frontend`
   (UI on http://localhost:5173) in two terminals.

## You MAY freely edit (the design surface)

Everything under `frontend/src/` EXCEPT the protected list below. In particular:

- `frontend/src/App.tsx` (the shell and navigation)
- `frontend/src/auth/Login.tsx`
- `frontend/src/dashboard/`, `calendar/`, `deadlines/`, `browse/`, `admin/` components
- Any new components, styles, CSS, theme, or assets you add

These files get their data and actions from hooks like `useDashboard()`, `useMembers()`,
`useMeetingDay()`, and `useAuth()`. Call those and render. You never write a fetch, a URL,
or a token.

## DO NOT EDIT (the protected wiring)

- `frontend/src/lib/**` — the Supabase client, the `api()` helper, the data hooks, date
  utils, and shared types. Every file here starts with a "PROTECTED WIRING" header.
- `frontend/src/auth/AuthProvider.tsx` — the session + role context.
- Anything outside `frontend/` (`worker/`, `types/`, `wrangler.toml`, migrations, env files).

Changing these can break login, data loading, or the deployment. If you think you need a
new piece of data or a new action, ask for it to be added to a hook rather than calling the
API from a component.

## Contracts you must keep

- Login stays a passwordless email flow (`useAuth().sendMagicLink(email)`).
- Admin-only screens render only when `useAuth().isAdmin` is true.
- Keep using the hooks' field names (they mirror the database, snake_case).
- No em dashes in any copy.
