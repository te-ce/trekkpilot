# 002 - Score and rank into top 3 candidates

**Type**: AFK

## What to build

Make the single-route pipeline from 001 into a real candidate-selection flow.
Call the `round_trip` mode of ORS more than one time, with different seed and
heading parameters. These calls give several different loop candidates for the
same duration and start point.

Score each candidate with one weighted-sum formula. The formula combines these
terms:

- Total ascent (meters of climb)
- Raw turn or maneuver count (from the step count of ORS)
- Cycleway/footway ratio (the share of the route length with a dedicated-path
  tag, and not a road tag)
- Construction-tag penalty (best effort, from static OSM `construction=*` tags
  only, with no live roadwork data)

Use sensible default weights. This slice has no user control for the weights,
because that is a later nicety. Sort the candidates by score and return the top
three. Show the three as a list, with a map preview and a score breakdown for
each candidate, so that the user can select one.

## Acceptance criteria

- [ ] The backend generates more than one round-trip candidate for each request.
- [ ] The weighted-sum formula scores each candidate on ascent, turn count,
      path-type ratio, and construction-tag penalty.
- [ ] The top three scored candidates come back, with the best one first.
- [ ] The frontend shows all three with their individual metric values, and not
      one opaque score number only.
- [ ] The user can select one of the three as the active route.

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
