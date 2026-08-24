# TrekkPilot

Route planning for cycling and trekking that starts from the time you have,
not the place you're going. Tell it you've got an hour, and it finds three
loops from where you're standing, scores them on climbing, turns and how much
of the way runs on dedicated bike paths, and hands you the one you pick as a
GPX file or a Google Maps link.

Point-to-point works too: name a start and a destination and it ranks three
ways to get there.

## What it does

- **Loop routes from a time budget.** Duration and activity convert to a target
  distance (15 km/h cycling, 4.5 km/h trekking), which drives OpenRouteService's
  `round_trip` mode.
- **Three candidates, ranked.** Five seeded round-trip calls per search; the
  best three come back scored on total ascent, turn count, share of the route on
  cycleway/footway, and a construction penalty.
- **Re-rank without refetching.** Every metric ships with every candidate, so
  changing what you're optimising for (flattest, gentlest climbs, most bike
  path, fewest turns) reorders the three instantly, client-side.
- **Point-to-point alternatives** between two named or searched locations.
- **Live position** on the active route while the app is in the foreground, with
  a follow toggle. No background tracking.
- **Exports.** GPX reproduces the scored geometry exactly, for Komoot or any
  GPX-compatible app. The Google Maps link is an approximation — Google
  recalculates directions through at most nine waypoints.
- **History** in `localStorage`. Device-local, no account, no backend storage.

## How it works

A TanStack Start app. The OpenRouteService API key lives only in server
functions and never reaches the browser — `pnpm build` output is grepped for it
as part of the checks below.

```
src/
  routes/index.tsx      the whole app: map, pill bar, bottom sheet
  components/           map canvas, sheet panels, controls
  lib/                  pure client logic: ranking, formatting, sheet state,
                        route history, GPX and Google Maps builders
  server/               ORS calls, scoring, geocoding
    functions/          server-function boundary (the API key stops here)
```

The UI is map-first and built mobile-first: a full-bleed map with a floating
pill bar and a bottom sheet, which becomes a floating card from `md` up. Sheet
state is derived from intent plus data rather than stored, so it can't sit on an
empty view.

Scoring is a single weighted sum (`src/server/scoring.ts`), tuned to favour
flatter, less turn-heavy, path-dedicated routes:

| Term                         | Weight |
| ---------------------------- | ------ |
| Ascent (per metre)           | −0.05  |
| Turns (per manoeuvre)        | −0.5   |
| Cycleway/footway ratio (0–1) | +50    |
| Construction ratio (0–1)     | −100   |

The elevation term can follow total ascent, net elevation change, or max
gradient. The server uses it to pick the top three; the client re-ranks those
three.

## Setup

Node 24 and pnpm (developed against pnpm 11; CI runs Node 24).

```bash
pnpm install
```

You need an OpenRouteService API key — the free tier is enough. Create an
account from the [ORS developer login](https://openrouteservice.org/dev/#/login),
then generate a token on the [dashboard](https://openrouteservice.org/dev/#/home)
(ORS accounts are managed through HeiGIT Account, so the login may hand you off
to `account.heigit.org`). Put the token in a `.env` file in the repo root:

```bash
echo 'ORS_API_KEY=your-key-here' > .env
```

`.env` is gitignored, and the key is read server-side only. An environment
variable works just as well if you'd rather not keep a file:

```bash
ORS_API_KEY=your-key-here pnpm dev
```

Then:

```bash
pnpm dev          # http://localhost:3000
```

Without a key the app loads and the map renders, but any search fails — the
server function throws `ORS_API_KEY is not configured on the server`.

`ORS_BASE_URL` optionally overrides where those requests go. It defaults to
`https://api.openrouteservice.org`, so production needs no setting; it exists so
a test run can point the app at a fixture ORS server (`e2e/fixtures/`) and drive
the whole journey without a key, without network access, and without spending
free-tier quota. Like the API key, it is read server-side only. The Playwright
suite sets it for you — see _Testing and quality gates_.

The free tier is rate-limited, and each loop search spends **five** directions
requests (one per seed), plus one geocoding request per location you search by
name.

## Scripts

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `pnpm dev`             | Dev server on port 3000                     |
| `pnpm build`           | Production build                            |
| `pnpm preview`         | Serve the production build                  |
| `pnpm test`            | Vitest in watch mode                        |
| `pnpm test:run`        | Vitest once                                 |
| `pnpm coverage`        | Vitest with coverage                        |
| `pnpm e2e`             | Playwright against a preview build          |
| `pnpm e2e:smoke`       | The `@smoke`-tagged Playwright subset       |
| `pnpm typecheck`       | `tsc -b`                                    |
| `pnpm lint`            | oxlint, type-aware                          |
| `pnpm lint:fix`        | oxlint with `--fix`                         |
| `pnpm format`          | Prettier over the repo                      |
| `pnpm knip`            | Find unused files, exports and dependencies |
| `pnpm generate-routes` | Regenerate `src/routeTree.gen.ts`           |

Add route files under `src/routes` — TanStack Router regenerates
`src/routeTree.gen.ts` for you. `#/*` imports map to `./src/*`.

## Testing and quality gates

The suite is unit and integration tests in Vitest with Testing Library, plus a
Playwright suite that runs against a real production preview build. In Vitest,
ORS is mocked at the `fetch` boundary; scoring, ranking, GPX and history are
covered as pure functions.

End to end, ORS is stood in for by a local fixture server (`e2e/fixtures/`), a
dependency-free `node:http` server started for the run in `e2e/global-setup.ts`
and reached because `playwright.config.ts` sets `ORS_BASE_URL` (and a dummy
`ORS_API_KEY`) for the preview server. The fixtures reproduce real ORS GeoJSON
field for field — `[lon, lat, elevation]` coordinate triples, `summary`,
`segments[].steps[]`, and `extras.waytype.summary[]` with ORS's numeric waytype
codes — and the five loop candidates differ enough in ascent, turns and waytype
mix that the top-three cut and the ranking control both have real work to do. So
`pnpm e2e` covers searching, re-ranking, selecting, GPX export, the Google Maps
link, history and the point-to-point flow with no key, no network and no quota
spent. `pnpm e2e:smoke` runs the `@smoke`-tagged subset.

A husky pre-commit hook runs lint-staged, `tsc -b` and the full Vitest suite, so
a commit can't land red. CI additionally runs coverage, `knip`, and the
Playwright job.

## Known limitations

- **Some ORS response details are believed, not verified.** Searching works
  against a live key, but a few specifics have only ever been exercised against
  our own fixtures, which were written to match what the code reads — so they
  encode the current belief rather than proving it: the numeric `waytype` codes
  behind the path-type ratio and the construction penalty (the API exposes no
  dedicated `construction=*` bucket, so one code is reused for both), the
  response carrying `properties.extras` rather than `extra_info`, the `api_key`
  query parameter on `/geocode/search`, and the `share_factor`/`weight_factor`
  values for `alternative_routes`. Missing or misread data degrades one scoring
  signal rather than crashing a search, which is why a wrong guess here shows up
  as a metric that is always 0% rather than as an error.
- **Net elevation change is near zero for loops** by definition — it's most
  useful in point-to-point mode.
- **Point-to-point ignores the time budget.** It ranks three ways to a
  destination; it doesn't box them by duration.
- **Return trips are out of scope.** Only the outbound leg is routed.
- The OSM attribution can sit behind the bottom sheet on a phone, and the
  sheet's drag handle is an affordance without a drag gesture behind it yet.

## Docs

`docs/done/` holds the specs the app was built from, one file per shipped slice,
in implementation order.
