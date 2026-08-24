# 003 - Elevation metric toggle

**Type**: AFK

## What to build

Let the user choose which elevation metric drives scoring and display: total ascent (sum of uphill meters), net elevation change (start vs end — near-zero for loops), or max gradient (steepest single climb). Default to total ascent.

The chosen metric feeds into the weighted-sum scoring formula from 002 in place of the hardcoded total-ascent term, and the per-candidate display shows the selected metric's value instead of (or alongside) total ascent.

## Acceptance criteria

- [ ] UI control lets user pick ascent / net-change / max-gradient
- [ ] Scoring formula uses the selected metric for the elevation term
- [ ] Candidate list display reflects the selected metric's value
- [ ] Default remains total ascent when user hasn't changed it

## Blocked by

- 002 - Score & rank into top 3 candidates
