# 001 - Walking skeleton: single loop route end-to-end

**Type**: AFK

## What to build

Prove that the full stack works end to end for the simplest case: one loop
route, with no scoring.

The user selects an activity (cycling or trekking) and a target duration. The
current GPS position is the start point. The duration becomes a target distance
through a fixed default speed for each activity (15 km/h for cycling, 4.5 km/h
for walking). A minimal serverless function holds the OpenRouteService API key.
This function calls the `round_trip` mode of ORS with the target distance and
the start point, and returns the route (geometry and basic stats). The frontend
shows this one route on a map (Leaflet or MapLibre with OSM tiles).

This slice has no ranking, no scoring, no export, and no history. The user picks
a duration and sees one loop route on a map.

## Acceptance criteria

- [ ] The user can select the activity type (cycling or trekking) and enter a
      target duration.
- [ ] The app reads the current GPS position as the start point. A manual
      override can drop a pin, for tests without GPS.
- [ ] The serverless function calls the `round_trip` mode of ORS with the target
      distance from the duration, and returns the route geometry.
- [ ] The ORS API key stays in the serverless function and never gets to the
      client.
- [ ] The map shows the route correctly, as a closed loop that starts and ends
      at the selected point.

## Blocked by

None. Work can start immediately.
