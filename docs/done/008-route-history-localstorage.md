# 008 - Route history in localStorage

**Type**: AFK

## What to build

Keep the generated and selected routes in the `localStorage` of the browser. The
data stays on the device, and needs no backend and no account. This matches the
stateless-backend approach of the app.

Add a simple history view. This view lists the past routes with activity,
duration, date, and score summary. The user can open a route again to look at
it, to export it again, or to search for it again.

## Acceptance criteria

- [ ] When the user selects or exports a route, the app saves a record of it to
      localStorage.
- [ ] The history view lists the saved routes with enough summary data for the
      user to recognize them: activity, duration, date, and score.
- [ ] The user can open a saved route again, look at it on the map, and export
      it again.
- [ ] The history stays on the device. There is no sync, no account, and no
      backend storage.

## Blocked by

- 002 - Score and rank into top 3 candidates
