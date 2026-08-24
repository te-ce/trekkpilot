# 005 - Live blue-dot tracking on selected route

**Type**: AFK

## What to build

Once a route is selected (from 001/002), show the user's live position on the map against that route using the browser's foreground Geolocation API. No background tracking, no voice guidance, no rerouting — just a live dot on the map while the app is open and in the foreground. This is a lightweight "am I still on track" glance, not a replacement for real navigation (that's Komoot/Google Maps export, see 006/007).

## Acceptance criteria

- [ ] While a route is active and the app is in the foreground, user's live position renders on the map
- [ ] Position updates as the user moves (reasonable polling/update interval, no need for high-frequency tracking)
- [ ] No background tracking, no crash/battery drain when app is backgrounded (tracking simply pauses)

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
