# Phase 9: README + Seeds + Free-Tier Sanity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Final deliverables (PRD Section 9/10.9): a complete from-scratch free-Cloudflare deploy README, consolidated migrate/seed commands, and a free-tier sanity pass. Also close the one real deploy gap: Pages (frontend) and the Worker are separate origins, so add Worker CORS + a configurable frontend API base so the deployed app actually works.

**Architecture:** Worker gains a CORS middleware (allowed origin from `FRONTEND_ORIGIN`, default `*`; we use bearer tokens, not cookies). Frontend gains `VITE_API_BASE` (empty in dev so the Vite proxy is used; the workers.dev URL in prod). Root npm scripts wrap the migrate/seed commands. README is rewritten end to end.

**Tech Stack:** Hono (cors), Vite, Wrangler.

---

## Task 1: deploy-correctness (CORS + API base) (TDD)
- [ ] `bindings.ts`: add optional `FRONTEND_ORIGIN?: string`.
- [ ] `index.ts`: `app.use("/api/*", cors({ origin: (o, c) => c.env?.FRONTEND_ORIGIN ?? "*", allowHeaders, allowMethods }))`.
- [ ] `worker/test/cors.test.ts`: a request with an `Origin` header gets an `Access-Control-Allow-Origin` response header.
- [ ] `frontend/src/api.ts`: prefix all fetches with `API_BASE = import.meta.env.VITE_API_BASE ?? ""`.
- [ ] `frontend/.env.example`: document `VITE_API_BASE`.
- [ ] Tests pass. Commit.

## Task 2: consolidated seed/migrate scripts
- [ ] Root `package.json`: add `migrate:local`, `migrate:remote`, `seed:local`, `seed:remote`, `setup:local` (migrate + seed).
- [ ] Commit.

## Task 3: README rewrite
- [ ] Rewrite `README.md`: what it is + feature list; local dev (two env files, two servers); full first-time deploy (D1 create, R2 create, apply 4 migrations, roster seed, set `SUPABASE_ANON_KEY` secret + `SUPABASE_URL`/`ADMIN_EMAIL`/`FRONTEND_ORIGIN` vars, `wrangler deploy`, Pages build with `VITE_API_BASE`); Supabase setup (URL/anon key, redirect allowlist, custom SMTP note); free-tier table + sanity reasoning; project structure; API overview; Drive stub note; acceptance-criteria checklist.
- [ ] Commit.

## Task 4: free-tier sanity + final verification
- [ ] Confirm Worker bundle size (dry-run) and frontend gzip size are well within limits; note in README.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run`. Commit.

## Self-Review
- README from-scratch deploy -> Task 3. Seeds consolidated -> Task 2. Free-tier sanity -> Task 4. Deploy actually works cross-origin -> Task 1. This completes PRD v1 build order (Phases 1-9).
- Type consistency: `FRONTEND_ORIGIN` optional in Env; `VITE_API_BASE` optional; CORS allows Authorization + Content-Type for the bearer flow.
