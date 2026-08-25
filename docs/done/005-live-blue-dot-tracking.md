# 005 - Live blue-dot tracking on selected route

**Type**: AFK

## What to build

After the user selects a route (from 001 and 002), show the live position of the
user on the map against that route. Use the Geolocation API of the browser in
the foreground. There is no background tracking, no voice guidance, and no
rerouting. There is a live dot on the map while the app is open and in the
foreground.

This is a light "am I still on track" glance. It does not replace real
navigation, which is the export to Komoot or Google Maps (see 006 and 007).

## Acceptance criteria

- [ ] While a route is active and the app is in the foreground, the map shows
      the live position of the user.
- [ ] The position updates as the user moves. A sensible update interval is
      sufficient, and high-frequency tracking is not necessary.
- [ ] There is no background tracking. The app does not crash and does not drain
      the battery in the background, because tracking stops there.

## Blocked by

- 001 - Walking skeleton: single loop route end-to-end
