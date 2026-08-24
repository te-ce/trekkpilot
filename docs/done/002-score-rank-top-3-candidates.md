# 002 - Score & rank into top 3 candidates

**Type**: AFK

## What to build

Extend the single-route pipeline (001) into a real candidate-selection flow. Call ORS `round_trip` multiple times with varied seed/heading parameters to get several distinct loop candidates for the same duration and start point.

Score each candidate with a single weighted-sum formula combining:

- total ascent (meters climbed)
- raw turn/maneuver count (from ORS step count)
- cycleway/footway ratio (share of route length tagged as dedicated path vs road)
- construction-tag penalty (best-effort, from static OSM `construction=*` tags only — no live roadwork data)

Use sane default weights (no user-adjustable weighting in this slice — that's a later nicety). Sort candidates by score, return the top 3, and display them as a list (map preview + score breakdown per candidate) so the user can pick one.

## Acceptance criteria

- [ ] Backend generates multiple round-trip candidates per request (not just one)
- [ ] Each candidate is scored via the weighted-sum formula covering ascent, turn count, path-type ratio, and construction-tag penalty
- [ ] Top 3 scored candidates are returned, sorted best-first
- [ ] Frontend displays all 3 with their individual metric values (not just a single opaque score number)
- [ ] User can select one of the 3 to view/use as the active route

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
