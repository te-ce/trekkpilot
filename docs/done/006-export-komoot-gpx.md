# 006 - Export to Komoot (GPX, exact route)

**Type**: AFK

## What to build

For a selected route (from 002), generate a GPX file that reproduces the exact
geometry of the route. The user can then download the file or open it for import
into Komoot.

This is the export path for the exact route. Komoot supports full GPX import.
Thus the shaped route, with all the path choices that the score is made of,
carries over faithfully. A Google Maps deep link does not do this.

## Acceptance criteria

- [ ] The app can export the selected route as a valid GPX file that matches the
      computed geometry exactly.
- [ ] The user can download the file, or start a share action that gives the
      file to Komoot or to any GPX-compatible app.
- [ ] The GPX file holds the waypoints and the track that were scored and shown,
      and not a simplified approximation.

## Blocked by

- 002 - Score and rank into top 3 candidates
