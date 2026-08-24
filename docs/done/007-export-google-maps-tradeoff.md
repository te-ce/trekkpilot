# 007 - Export to Google Maps (approximate) + in-app tradeoff label

**Type**: AFK

## What to build

Add a second export option using a Google Maps deep link (start/end/waypoints, ~9 waypoint max — Google Maps has no arbitrary-polyline import). Since this can only approximate the scored route rather than reproduce it exactly, show clear in-app labeling next to both export options explaining the tradeoff: Komoot (006) = exact route via GPX; Google Maps = approximate directions through the same general path, may deviate from the scored route.

## Acceptance criteria

- [ ] Google Maps export generates a deep link using the route's start/end and a reasonable subset of waypoints (≤9)
- [ ] Tapping/clicking the export opens Google Maps with those points pre-loaded
- [ ] UI clearly labels this export as "approximate" next to Komoot's "exact route" label, so the user understands the difference before choosing

## Blocked by

- 006 - Export to Komoot (GPX, exact route)
