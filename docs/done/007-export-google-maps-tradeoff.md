# 007 - Export to Google Maps (approximate) and in-app tradeoff label

**Type**: AFK

## What to build

Add a second export option that uses a Google Maps deep link with a start, an
end, and waypoints. Google Maps accepts approximately nine waypoints and has no
import for an arbitrary polyline.

This link can only approximate the scored route, and cannot reproduce it
exactly. Thus show a clear label in the app next to both export options, to
explain the tradeoff. Komoot (006) gives the exact route through GPX. Google
Maps gives approximate directions through the same general path, and these
directions can deviate from the scored route.

## Acceptance criteria

- [ ] The Google Maps export generates a deep link with the start and the end of
      the route, and a sensible subset of the waypoints (9 or fewer).
- [ ] When the user taps or clicks the export, Google Maps opens with these
      points loaded.
- [ ] The UI labels this export as "approximate", next to the "exact route"
      label of Komoot. Thus the user knows the difference before the selection.

## Blocked by

- 006 - Export to Komoot (GPX, exact route)
