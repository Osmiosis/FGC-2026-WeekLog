# WeekLog Development Log

## Session: 2026-07-02 (Download-all-media fix + Notebook Prep pipeline v1)

Author: pairing session with Claude Code (Opus 4.8).
Scope: `9a37e3e..7b7f873` on `master`. 41 commits, 45 files, +5534 / -59.
Two workstreams: (1) fixing the broken "Download all media" ZIP, (2) designing
and shipping the entire Notebook Prep pipeline (Slices B through E).

All work followed the same discipline throughout: systematic debugging for the
bug, then brainstorm to spec to plan to subagent-driven execution (fresh
implementer per task, a spec-plus-quality review after each task, a whole-branch
review at the end) for each feature slice, then merge to `master`, verify, and
deploy. No runtime LLM API was added anywhere; the only AI is Claude Code, run by
the operator. Standing project rule honored everywhere: no em dashes.

---

## Workstream 1: "Download all media (ZIP)" was broken

### Symptom
The button did nothing. No user-visible error.

### Investigation (systematic debugging)
- Read the path end to end: frontend `downloadAllMedia` -> `downloadAuthed` ->
  `apiBlobUrl` (throws on non-OK) -> Worker `GET /api/export/all-media/zip`.
- Confirmed the endpoint was open-access (the auth model is public-member), so
  auth was not the blocker.
- Got the real signal from the browser Network tab: **503 Service Unavailable**,
  `content-type: text/html`, `server: cloudflare`. That is a Cloudflare-generated
  error page, not the Worker's own JSON error, meaning the Worker isolate was
  killed by the platform rather than returning an application error.

### Problem 1 and the first (partial) fix: memory
- The endpoint buffered every media file into memory (`new Uint8Array(await
  obj.arrayBuffer())` per file) and then built the whole archive with
  `zipSync(...)`. Peak memory was roughly (all media bytes) + (the full zip
  output) at once. The per-file cap had just been raised 10 MB -> 25 MB and
  multi-file upload had been added, so the set had grown.
- Fix: rewrote both the all-media and per-day zip endpoints to **stream** the
  archive with `fflate.Zip` + `ZipPassThrough` into a `TransformStream` response,
  pulling each R2 object one at a time with backpressure. Extracted a shared
  `worker/src/zipStream.ts` helper. Deployed.

### Problem 2: it still failed, and the real root cause was CPU
- After the streaming fix, the endpoint sometimes returned the full ~404 MB
  archive, sometimes an empty body, then consistently 503 again.
- Ran `wrangler tail` on the live Worker and captured the decisive evidence:
  `"outcome": "exceededCpu"`, `"message": "Worker exceeded CPU time limit."`
- Conclusion: the media set is about **404 MB**. Reading every byte and computing
  each file's CRC32 to build a ZIP is too much compute for a single Worker
  invocation. Streaming fixed the memory ceiling but not the CPU ceiling. You
  cannot zip 404 MB inside a (free-tier) Worker.

### Decision: build the ZIP in the browser
Presented three options (client-side ZIP, per-meeting ZIPs, upgrade to Workers
Paid). The user chose **client-side ZIP**. Rationale: it keeps per-request Worker
work tiny, stays on the free tier, and scales to any size.

### What we built
- Worker `GET /api/notebook/... ` (export) `GET /api/export/manifest`: a cheap
  JSON manifest (file list, folders, inline text summaries, media ids), no bytes.
- Frontend `frontend/src/lib/downloadZip.ts`: fetches the manifest, pulls each
  file from `/api/media/:id/file`, and streams into a ZIP saved to disk via the
  File System Access API (Chromium) with an in-memory Blob fallback. Shows
  `Zipping n/total` progress.
- Surfaced failures: `downloadAllMedia` now awaits and shows an error instead of
  failing silently.

### Result
Verified live: `/api/export/all-media/zip` had been returning 503 on a ~404 MB
set; the manifest returns 200 in ~2.4 s and per-file fetches are ~300 ms. The
button now works via the browser regardless of set size.

Commits: `622bc7f`, `6df785c`, `18d4b1c`, `a11f6fe`.

---

## Workstream 2: Notebook Prep pipeline v1

### The idea
A new PRD (`PRD'S/PRD_notebook_prep.md`) plus a reference brief
(`PRD'S/FGC_NOTEBOOK_REFERENCE_BRIEF.md`) landed. Notebook Prep mines the logged
WeekLog season into engineering-notebook prep material. It is a **super-helper,
never a ghost-writer**: outputs are deliberately un-submittable (raw material,
audits, and `[NEEDS: ...]` placeholders). The team writes the notebook.

### The unusual runtime model
No runtime LLM API and no ongoing cost. **Claude Code is both the builder and the
reasoning engine.** Deterministic reports (timeline, coverage, season) are Worker
compute; reasoning reports (gaps, decisions, scaffold) are authored offline by
Claude Code, following `NOTEBOOK_PREP.md`, and published through a secret-gated
write-back route. The view renders whatever is published and does not care how a
row was produced.

### Decomposition
Too large for one spec, so it was cut into four slices, each its own spec, plan,
and execution cycle:
- **Slice B: Timelines** (deterministic, plus the publish/request machinery).
- **Slice C: Gaps + shared reasoning/publish infrastructure** (the hard, reusable
  part: `/season`, `/coverage`, secret-gated `/publish`, the runbook).
- **Slice D: Decisions** (thin, reuses everything).
- **Slice E: Scaffold** (thin, the final tab).

### Data model and taxonomy decisions
- Report kinds: `timeline | gaps | decisions | scaffold`. One current snapshot row
  per kind (`notebook_reports`, unique `kind`), latest wins. Teammate refresh
  requests live in `notebook_requests`.
- Subsystem taxonomy is the existing **committees** table. Verified against
  production: `submissions.subsystem` is populated and matches committee names;
  null-subsystem entries bucket to "Uncategorized".
- Entry kinds are the DB-native values (`accomplishment`, `failure`, `build_need`,
  `performance_goal`, `note`). We deliberately kept `performance_goal` rather than
  the PRD draft's `goal`, to avoid a lossy remap and keep entries verbatim.
- Photos are date-keyed, not attributed to a subsystem, because `media.subsystem`
  is 100% null in production (89/89). Attaching a photo to one subsystem would
  misfile it, so the Timeline shows per-date "meeting photos" instead.

### Slice B: Timelines
- Shared `@weeklog/types` contract, `notebook_reports` + `notebook_requests`
  migration (`0008`), `/api/notebook` routes (reports, requests, admin
  `generate/timeline`), the `useNotebook` hook, the Timeline tab, and the Notebook
  Prep view wired into both the desktop sidebar and the mobile More sheet.
- Uniform snapshot read path chosen (view reads the latest snapshot per kind, not
  a live compute), so the AI phases could reuse it later.
- Teammate refresh requests: any member can queue a pending request that awaits
  the admin. Built generically so later AI tabs reuse it.
- Post-review fixes: deduped per-date photos, surfaced the hook error, fixed the
  mobile More highlight.
- Shipped: worker + Pages, D1 migration `0008` applied to prod.

Commits: `3877fa6`, `72e1d63`, `6a3afde`, `fc6655c`, `4310ddc`, `621ac4e`,
`df23cd8`, `f9222a7`, `4b98e47`.

### Slice C: Gaps + reasoning/publish infrastructure
The architecturally heavy slice. Key decisions:
- **Publish authentication = a dedicated secret**, `NOTEBOOK_PUBLISH_SECRET`,
  compared against an `X-Notebook-Secret` header. A machine credential with no
  expiry, right for a Claude-Code-driven publish. 503 if the secret is unset, 401
  on mismatch. The route is not user-gated; the secret is the gate.
- **The pipeline is run from a runbook** (`NOTEBOOK_PREP.md`), the operator's
  procedure that Claude Code follows. Chosen over a packaged skill for
  transparency and lowest complexity.
- New deterministic reads: `GET /api/notebook/season` (normalized dump, media
  metadata only) and `GET /api/notebook/coverage` (Worker-computed objective
  counts so numbers are never AI-invented).
- `POST /api/notebook/publish` accepts any report kind and reuses a shared
  `saveReport` helper (which also backs `generate/timeline`, DRYing the Slice-B
  write path).
- Gaps tab renders RAG cards (strong green, thin amber, missing red) per FGC
  criterion. AI-kind controls differ from Timeline: no in-app Generate; refresh is
  via the runbook.
- Post-review hardening: `/publish` returns 400 on malformed JSON; GapsTab is
  malformed-payload-safe; coverage ordering made deterministic; added coverage
  tests for spread and resolved build-needs.

Commits: `33fe5a6`, `60a334d`, `034b081`, `82fb9f2`, `c351db4`, `768a1a1`,
`cc30aa5`, `c2fbd29`, `70b93ab`.

### Slice D: Decisions
Thin, no worker changes (the `decisions` kind was already handled generically). A
`DecisionPayload` type, a checklist tab (chosen line + amber "Needs:
why/numbers/alternatives/result" chips + fill-in prompt), enable the tab, and a
runbook section.

Commits: `36486a9`, `3f6bd62`, `fcfcebd`, `af68aeb`.

### Slice E: Scaffold
The final tab, again thin and no worker changes. A `ScaffoldPayload` type, a DRAFT
worksheet tab (NOT-FOR-SUBMISSION banner, verbatim raw material, amber "NEEDS:
..." slots, plus a **Copy raw markdown** button so the team can move material into
their real notebook doc), enable the tab (all four now live), and a runbook
section.

Commits: `7d8a130`, `b3efae7`, `ace2661`, `db44420`.

### Publishing real reports
Gaps and Decisions were authored and published by the user from another Claude
Code session. Scaffold was authored in this session: fetched `/season` plus the
published gaps and decisions, produced an 8-section `ScaffoldPayload` (16 NEEDS
prompts) grounded entirely in the logged season (no invented facts), and published
it via the secret. All four kinds now show on `/api/notebook/reports`.

### Final copy tweak
Removed "The team writes the notebook" from the frontend (the persistent banner
and the ScaffoldTab default notice), updated the test, and re-published the
scaffold with a cleaned `draft_notice`. Scoped to the frontend; runbook and docs
untouched. Commit `7b7f873`.

---

## The secret setup (a debugging story worth recording)
Setting `NOTEBOOK_PUBLISH_SECRET` did not work on the first try: `/publish` kept
returning our own 503 "publish not configured" even though `wrangler secret list`
showed the secret present. The guard is `if (!secret)`, which fires on unset **or
empty string**. The interactive `wrangler secret put` prompt had captured an empty
value. Fix: generated a 64-char hex secret, wrote it to a gitignored
`.notebook-secret` file, and piped the exact bytes to `wrangler secret put`
(non-interactive, guaranteed non-empty and byte-identical on both sides). After a
redeploy, `/publish` returned 401 on a wrong header (active) and the real publish
returned 200. The runbook reads the value from `.notebook-secret` at publish time,
so nothing needs to be handed to Claude in chat.

---

## Process notes
- Every feature slice went brainstorm -> spec (`docs/superpowers/specs/`) -> plan
  (`docs/superpowers/plans/`) -> subagent-driven execution -> whole-branch review
  -> merge -> verify -> deploy.
- Model tiers by role: cheap (haiku) for transcription-style implementers where
  the plan carried complete code, standard (sonnet) for integration tasks and all
  task reviewers, most capable (opus) for the whole-branch final reviews.
- A progress ledger (`.superpowers/sdd/progress.md`, gitignored) tracked each
  slice's task status and the Minor findings for final triage.

## Deployments this session
- Worker: several `wrangler deploy` runs (zip streaming, client-zip manifest,
  Notebook Prep routes across slices, secret activation). Latest notebook version
  had `/season`, `/coverage`, `/publish` live.
- Frontend: Cloudflare Pages, production branch `main`, built with
  `VITE_API_BASE` baked in each time.
- D1: migration `0008_notebook.sql` applied to the remote `weeklog` database
  (only Slice B needed a migration; C, D, E were code-only for the DB).
- Secret: `NOTEBOOK_PUBLISH_SECRET` set on the Worker; mirror in `.notebook-secret`
  (gitignored).

## Problems and resolutions (quick table)
| Problem | Resolution |
| --- | --- |
| ZIP button silently did nothing | Root cause 503 from Cloudflare; the frontend swallowed the error. Surfaced errors and fixed the backend. |
| ZIP 503 assumed to be memory OOM | It was, partly. Streaming fixed memory but `wrangler tail` revealed the real ceiling was CPU (exceededCpu) on a ~404 MB set. |
| Cannot zip 404 MB in a Worker | Moved ZIP building to the browser (manifest + per-file fetch + client zip). |
| `@weeklog/types` workspace was orphaned | Wired it up; new shared types imported type-only by both apps (erased at runtime, resolved by tsc). |
| `media.subsystem` is 100% null | Photos are date-keyed in the timeline, not attributed to a subsystem. |
| Publish secret returned 503 after being set | Interactive prompt captured an empty value; re-set via a piped, byte-exact non-interactive command. |
| Duplicate per-date photos / unsurfaced errors / mobile highlight | Fixed in the Slice-B post-review pass. |

## Final state (what is live)
- `weeklog.pages.dev`: Download-all-media works via the browser; Notebook Prep has
  all four tabs live (Timeline, Gaps, Decisions, Scaffold), each carrying real
  published content.
- `weeklog-worker.fgcworker.workers.dev`: export manifest + per-file media, and the
  full `/api/notebook` surface (reports, requests, generate/timeline, season,
  coverage, publish).
- Pipeline v1 per the PRD is complete: deterministic tools plus offline Claude Code
  reasoning, published through the secret-gated write-back, rendered as
  RAG-legible tabs, at zero runtime AI cost.

## Deferred / follow-ups
- PRD-deferred (out of scope): judge-question rehearsal, notebook-health-over-time,
  DOCX export, tagging media with a subsystem at upload time.
- Logged Minor findings (non-blocking, in `.superpowers/sdd/progress.md`): a few
  defensive guards and test-coverage gaps, and the now-unreachable `!ready` tab
  branches (kept intentionally as the extension seam for a future 5th tab).
- Per-day ZIP endpoint still uses buffer-all; smaller, but the same latent risk if
  one day's media gets large.

## Commit index (session, oldest first)
```
622bc7f fix(export): stream ZIPs so bulk exports don't OOM the Worker
6df785c fix(dashboard): surface ZIP export failures instead of failing silently
18d4b1c feat(export): add manifest endpoint for client-side ZIP
a11f6fe feat(dashboard): build "Download all media" ZIP in the browser
c5e368a docs(prd): add Notebook Prep pipeline PRD + FGC reference brief
da148cb docs(spec): Notebook Prep slice B design
8db45d4 docs(plan): Notebook Prep slice B plan
3877fa6 feat(types): shared Notebook Prep report contract
72e1d63 feat(db): notebook_reports + notebook_requests tables
6a3afde feat(notebook): router + GET /reports
fc6655c feat(notebook): teammate refresh requests
4310ddc feat(notebook): admin generate/timeline + request fulfilment
621ac4e feat(notebook): useNotebook hook
df23cd8 feat(notebook): Timeline tab component
f9222a7 feat(notebook): Notebook Prep view + nav entry
4b98e47 fix(notebook): dedupe per-date photos, surface hook error, mobile More highlight
7c29227 docs(spec): Notebook Prep slice C design
3b8110e docs(plan): Notebook Prep slice C plan
33fe5a6 feat(types): gap/coverage/season contracts
60a334d feat(notebook): GET /coverage
034b081 feat(notebook): GET /season
82fb9f2 feat(notebook): secret-gated /publish + shared saveReport
c351db4 feat(notebook): Gaps RAG-card tab
768a1a1 feat(notebook): enable Gaps tab with tab-aware controls
cc30aa5 docs(notebook): NOTEBOOK_PREP.md runbook, Gaps section
c2fbd29 fix(notebook): harden /publish + GapsTab, deterministic coverage order
70b93ab chore: gitignore .notebook-secret
da7bb3d docs(spec): Notebook Prep slice D design
bef5662 docs(plan): Notebook Prep slice D plan
36486a9 feat(types): DecisionPayload contract
3f6bd62 feat(notebook): Decisions checklist tab
fcfcebd feat(notebook): enable Decisions tab
af68aeb docs(notebook): NOTEBOOK_PREP.md Decisions section
e98ce1b docs(spec): Notebook Prep slice E design
e87c103 docs(plan): Notebook Prep slice E plan
7d8a130 feat(types): ScaffoldPayload contract
b3efae7 feat(notebook): Scaffold DRAFT worksheet tab with copy-markdown
ace2661 feat(notebook): enable Scaffold tab (all four tabs live)
db44420 docs(notebook): NOTEBOOK_PREP.md Scaffold section
7b7f873 chore(notebook): drop 'The team writes the notebook' from frontend copy
```
