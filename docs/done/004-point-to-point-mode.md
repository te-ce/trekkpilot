# 004 - Point-to-point mode (start ≠ stop)

**Type**: AFK

## What to build

ORS's `round_trip` mode (used in 001/002) only produces loops back to the start point. Point-to-point routing needs a different call: the user always names a specific destination (e.g. "home → train station, best of 3 ways, ~30min"). This is a duration-boxed alternates problem, not endpoint-discovery — use ORS's directions/alternative-routes call between the two known points instead of `round_trip`.

Score each alternative with the same weighted-sum formula from 002/003 (ascent per chosen elevation metric, turn count, path-type ratio, construction-tag penalty) and return the top 3, same as loop mode. Return trip stays explicitly out of scope — the app only routes the outbound leg.

## Acceptance criteria

- [ ] User can set a stop point different from the start point (both as named/searched locations, not just current-GPS)
- [ ] Backend requests alternative routes between the two points from ORS
- [ ] Each alternative is scored using the same formula as loop mode (002/003)
- [ ] Top 3 scored alternatives are returned and displayed the same way as loop candidates
- [ ] Return-trip is explicitly out of scope — app only routes the outbound leg

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
- 002 - Score & rank into top 3 candidates
