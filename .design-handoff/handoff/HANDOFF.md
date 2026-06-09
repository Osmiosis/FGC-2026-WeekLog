# Team Qatar Logbook, frontend restyle handoff

This folder is a drop-in restyle of the `frontend/` presentation layer. It only
touches the design surface listed in `DESIGN.md`. It does **not** modify any
protected wiring (`lib/**`, `AuthProvider.tsx`) and it calls every data hook with
the same arguments and snake_case field names they already use.

Dark editorial theme, Qatar maroon as brand chrome, red / amber / green as a
separate status language (always icon + label, never color alone). Responsive:
bottom tab bar on phones, left sidebar on laptops (breakpoint 900px).

## What maps where

Copy these into your repo (overwriting the current placeholder-styled versions):

| From (this folder)                     | To (your repo)                          |
| -------------------------------------- | --------------------------------------- |
| `src/theme/base.css`                   | `frontend/src/theme/base.css`           |
| `src/theme/app.css`                    | `frontend/src/theme/app.css`            |
| `src/ui/Icon.tsx`                      | `frontend/src/ui/Icon.tsx`              |
| `src/ui/primitives.tsx`                | `frontend/src/ui/primitives.tsx`        |
| `src/App.tsx`                          | `frontend/src/App.tsx`                  |
| `src/auth/Login.tsx`                   | `frontend/src/auth/Login.tsx`           |
| `src/dashboard/Dashboard.tsx`          | `frontend/src/dashboard/Dashboard.tsx`  |
| `src/calendar/CalendarView.tsx`        | `frontend/src/calendar/CalendarView.tsx`|
| `src/calendar/MeetingDayDetail.tsx`    | `frontend/src/calendar/MeetingDayDetail.tsx` |
| `src/deadlines/DeadlinesView.tsx`      | `frontend/src/deadlines/DeadlinesView.tsx` |
| `src/browse/BrowseView.tsx`            | `frontend/src/browse/BrowseView.tsx`    |
| `src/admin/MembersAdmin.tsx`           | `frontend/src/admin/MembersAdmin.tsx`   |
| `src/admin/TemplatesAdmin.tsx`         | `frontend/src/admin/TemplatesAdmin.tsx` |
| `public/team-qatar-logo.png`           | `frontend/public/team-qatar-logo.png`   |

## Two wiring steps

1. **Import the theme once.** In `frontend/src/main.tsx`, add at the top:

   ```ts
   import "./theme/base.css";
   import "./theme/app.css";
   ```

   `base.css` `@import`s three Google fonts (Space Grotesk, Hanken Grotesk,
   Space Mono). If you prefer to self-host, drop the `@import` line and add the
   font files yourself; the CSS variables (`--disp`, `--body`, `--mono`) stay.

2. **The logo** is referenced as `/team-qatar-logo.png` (served from
   `frontend/public/`). Swap in a higher-res or transparent version any time;
   keep the filename or update the two `<img src>` references (Login, Brand).

That is the whole integration. `App.tsx` already wires `AuthProvider`, the
`isConfigured` guard, the loading and login states, the tab routing, and the
`openDay` -> calendar handoff exactly like the version you have now.

## Hook usage (unchanged contracts)

Every screen reads from the existing hooks and field names:

- `Dashboard` -> `useDashboard()` (`data`, `driveConfigured`, `downloadAllMedia`).
- `CalendarView` -> `useCalendar(year, month)` (`marked`, `markDay`, `reload`).
- `MeetingDayDetail` -> `useMeetingDay(dayId)` (`detail`, `attendance`,
  `submissions`, `media`, `setPresent`, `addSubmission`, `uploadMedia`, `unmark`,
  `downloadZip`) plus `useMediaUrl(id)` for thumbnails.
- `DeadlinesView` -> `useDeadlines()` + `useDeadlineProof(id)`.
- `BrowseView` -> `useBuildNeeds(showResolved)` + `useSearch()`.
- `MembersAdmin` -> `useMembers()` (`members`, `addMember`, `setActive`).
- `TemplatesAdmin` -> `useTemplates()` (`templates`, `add`, `patch`, `reorder`).
- `Login` -> `useAuth().sendMagicLink(email)` (keeps `emailRedirectTo`).

## Two things to know

- **A shared `ui/` folder is new.** `Icon.tsx` and `primitives.tsx` (RagTag,
  ScreenHead, Brand, DividerNum, useWide, fmtDate) are pure presentational
  helpers with no data access. Nothing else in your tree imports from `ui/`, so
  adding it is safe.

- **Bulk recurring mark** uses the existing single `markDay(date)` in a loop
  (one call per matching weekday in the visible month), so no hook change is
  needed. If you later add a real bulk endpoint to `useCalendar`, swap the loop
  in `CalendarView.applyBulk` for the single call. Everything else maps 1:1 to
  existing hook methods.

## Field-name notes

- Build-need / search rows read the day id as `meeting_day_id ?? day_id`
  (matches the current `BrowseView`).
- Deadline countdown is computed from `due_date` in the component; the RAG color
  still comes from the server's `status_rag`.
- Member toggles send `active: 0 | 1`; template toggles send `compulsory: 0 | 1`
  and `active: 0 | 1` via `patch`. All snake_case, as the API expects.

## Verify

From the repo root (per `DESIGN.md`):

```
npm run verify
```

Typecheck + tests + build. Green means the wiring is intact. No em dashes were
used in any copy.
