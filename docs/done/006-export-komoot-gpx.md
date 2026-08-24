# 006 - Export to Komoot (GPX, exact route)

**Type**: AFK

## What to build

For a selected route (from 002), generate a GPX file reproducing its exact geometry and let the user download/open it for import into Komoot. This is the "exact route" export path — Komoot supports full GPX import, so the shaped route (including all scoring-relevant path choices) carries over faithfully, unlike a Google Maps deep link.

## Acceptance criteria

- [ ] Selected route can be exported as a valid GPX file matching its computed geometry exactly
- [ ] User can download the file or trigger a share/open action that hands it to Komoot (or any GPX-compatible app)
- [ ] Exported GPX includes waypoints/track matching what was scored and displayed, not a simplified approximation

## Blocked by

- 002 - Score & rank into top 3 candidates
