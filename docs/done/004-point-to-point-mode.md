# 004 - Point-to-point mode (start ≠ stop)

**Type**: AFK

## What to build

The `round_trip` mode of ORS, used in 001 and 002, makes loops back to the start
point only. Point-to-point routing needs a different call, because the user
always names a specific destination (for example, "home to train station, best
of 3 ways, approximately 30 min"). This is a problem of duration-boxed
alternates, and not of endpoint discovery. Thus use the call for directions with
alternative routes between the two known points, and not `round_trip`.

Score each alternative with the same weighted-sum formula from 002 and 003:
ascent for the selected elevation metric, turn count, path-type ratio, and
construction-tag penalty. Return the top three, as loop mode does. The return
trip stays out of scope, because the app routes the outbound leg only.

## Acceptance criteria

- [ ] The user can set a stop point that is different from the start point. Both
      points can be named or searched locations, and not the current GPS
      position only.
- [ ] The backend requests alternative routes between the two points from ORS.
- [ ] The same formula as loop mode (002 and 003) scores each alternative.
- [ ] The top three scored alternatives come back, and the display is the same
      as for loop candidates.
- [ ] The return trip is out of scope. The app routes the outbound leg only.

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
- 002 - Score and rank into top 3 candidates
