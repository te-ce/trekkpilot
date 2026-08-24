# 001 - Walking skeleton: single loop route end-to-end

**Type**: AFK

## What to build

Prove the full stack works end-to-end for the simplest case: one loop route, no scoring yet.

User picks an activity (cycling or trekking) and a target duration, using their current GPS location as the start point. Convert duration to a target distance using a fixed default speed per activity (e.g. 15km/h cycling, 4.5km/h walking). A minimal serverless function holds the OpenRouteService API key, calls ORS's `round_trip` routing mode with that target distance and start point, and returns the resulting route (geometry + basic stats). The frontend renders that single route on a map (Leaflet/MapLibre + OSM tiles).

No ranking, no scoring, no export, no history yet — just: pick duration → see one loop route on a map.

## Acceptance criteria

- [ ] User can select activity type (cycling/trekking) and enter a target duration
- [ ] App reads current GPS location as start point (with manual override to drop a pin, for testing without GPS)
- [ ] Serverless function calls ORS `round_trip` mode with the duration-derived target distance and returns route geometry
- [ ] ORS API key lives only in the serverless function, never shipped to the client
- [ ] Route renders correctly on the map as a closed loop starting/ending at the chosen point

## Blocked by

None - can start immediately
