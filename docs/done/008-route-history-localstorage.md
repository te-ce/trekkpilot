# 008 - Route history in localStorage

**Type**: AFK

## What to build

Persist generated/selected routes to the browser's `localStorage` (device-local, no backend or account needed — matches the app's stateless-backend approach). Add a simple history view listing past routes (activity, duration, date, score summary) that the user can reopen to view again, re-export, or re-run.

## Acceptance criteria

- [ ] Selecting or exporting a route saves a record of it to localStorage
- [ ] History view lists saved routes with enough summary info to recognize them (activity, duration, date, score)
- [ ] User can reopen a saved route to view it on the map and re-export it
- [ ] History is device-local only — no sync, no account, no backend storage

## Blocked by

- 002 - Score & rank into top 3 candidates
