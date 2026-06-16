# WeekLog — Demo build

This is the `demo` branch: a fully interactive clone of WeekLog with **no backend**.

- **Auth is real:** sign in with the Supabase email magic-link (your Gmail works).
- **Data is local:** all app data is seeded sample data stored in your browser's
  localStorage. Anything you change (attendance, entries, members, deadlines)
  persists in your browser only. Use the **Reset** button (bottom-right DEMO pill)
  to restore the original sample.
- **Everyone is an admin** so you can explore every feature.

## How it works

The whole backend is replaced by an in-browser mock. Every data call still flows
through the same four functions in `frontend/src/lib/api.ts`, but on this branch
they delegate to `frontend/src/lib/demo/` instead of a Cloudflare Worker:

- `seed.ts` — evergreen sample dataset (dates are relative to today, so the
  red/amber/green health views always look realistic).
- `store.ts` — loads/saves the dataset in `localStorage` (key `weeklog-demo-v1`).
- `compute.ts` — requirement-status and RAG derivation, ported from the Worker.
- `router.ts` — maps each `/api/...` request to a handler over the local data.
- `media.ts` — holds uploaded image blobs in memory for the session.

Auth (`supabase.ts`, `AuthProvider.tsx`) is untouched and uses real Supabase.

## Known demo simplifications

- **Uploaded media:** the file metadata persists, but the image itself is held in
  memory for the session only. After a refresh, an uploaded image shows a
  placeholder. Seeded sample media always render.
- **ZIP / Drive export:** the ZIP buttons download a small text manifest (no real
  files are zipped). Google Drive export shows as "not configured."

## Running locally

```bash
cd frontend
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (VITE_API_BASE is unused in the demo)
npm install
npm run dev
```

## Deploying

Deploy this branch as a separate Cloudflare Pages project. The build needs only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (no `VITE_API_BASE`, no Worker).
Add the deployed URL to the Supabase Auth **Site URL / redirect allow-list** so
magic-link sign-in lands back on the demo.
