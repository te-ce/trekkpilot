# 003 - Elevation metric toggle

**Type**: AFK

## What to build

Let the user select which elevation metric drives the scoring and the display.
There are three metrics: total ascent (the sum of the uphill meters), net
elevation change (start against end, which is almost zero for loops), and max
gradient (the steepest single climb). The default is total ascent.

The selected metric goes into the weighted-sum formula from 002, in place of the
hardcoded total-ascent term. The display for each candidate shows the value of
the selected metric in place of total ascent, or with it.

## Acceptance criteria

- [ ] A UI control lets the user select ascent, net change, or max gradient.
- [ ] The scoring formula uses the selected metric for the elevation term.
- [ ] The candidate list shows the value of the selected metric.
- [ ] The default stays total ascent until the user changes it.

## Blocked by

- 002 - Score and rank into top 3 candidates
