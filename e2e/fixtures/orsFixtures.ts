/**
 * Fixture OpenRouteService responses for the end-to-end suite.
 *
 * These are the contract: the app reads real ORS GeoJSON, so every field the
 * scoring code touches is reproduced in the shape ORS actually returns it —
 * `[lon, lat, elevation]` coordinate triples (the app requests
 * `elevation: true`), `properties.summary.{distance,duration}`,
 * `properties.segments[].steps[]` for the turn count, and
 * `properties.extras.waytype.summary[]` entries of `{value, distance, amount}`
 * with ORS's numeric waytype codes (6 cycleway, 7 footway, 10 construction).
 *
 * NOTE on the extras key: `extra_info` is the *request* field asking for the
 * bucket; the response carries it back under `properties.extras`, which is
 * what `src/server/ors.ts` reads. Confirmed against the app's reader, not
 * against a live ORS response.
 *
 * The candidates are deliberately unlike each other in ascent, turn count and
 * waytype mix, so the top-3 cut and the client-side ranking control both have
 * something real to do. See `loopCandidateSpecs` for the arithmetic.
 */

/** A point on a route, in ORS's `[lon, lat, elevation]` order. */
export type OrsCoordinate = [number, number, number]

export type WaytypeSummaryEntry = {
  value: number
  distance: number
  amount: number
}

export type OrsFeature = {
  type: 'Feature'
  bbox: [number, number, number, number, number, number]
  geometry: { type: 'LineString'; coordinates: OrsCoordinate[] }
  properties: {
    segments: {
      distance: number
      duration: number
      steps: {
        distance: number
        duration: number
        type: number
        instruction: string
        name: string
        way_points: [number, number]
      }[]
    }[]
    extras: {
      waytype: {
        values: [number, number, number][]
        summary: WaytypeSummaryEntry[]
      }
    }
    summary: { distance: number; duration: number }
    way_points: number[]
  }
}

export type OrsDirectionsResponse = {
  type: 'FeatureCollection'
  bbox: [number, number, number, number, number, number]
  features: OrsFeature[]
  metadata: {
    attribution: string
    service: string
    timestamp: number
    engine: { version: string; build_date: string; graph_date: string }
  }
}

/**
 * What one fixture route is, in the terms the scoring formula cares about.
 * `ascentMeters` and `turnCount` are realised as geometry and steps below;
 * `pathPercent`/`constructionPercent` become waytype summary buckets.
 */
export type RouteSpec = {
  /** Reads in test failures, and nothing else depends on it. */
  name: string
  distanceMeters: number
  durationSeconds: number
  ascentMeters: number
  turnCount: number
  /** Share of the route on a dedicated cycleway/footway, as a percentage. */
  pathPercent: number
  /** Share of the route tagged as under construction, as a percentage. */
  constructionPercent: number
  /** How many coordinate triples the geometry has — the GPX `trkpt` count. */
  pointCount: number
}

/** Berlin Mitte, the centre the loop fixtures are drawn around. */
const LOOP_CENTER = { lat: 52.52, lon: 13.405 }

/** Roughly 700 m at this latitude — big enough for a plausible loop shape. */
const LOOP_RADIUS_DEGREES = 0.0063

const BASE_ELEVATION_METERS = 34

/**
 * The five seeded round-trip loops the app asks for (one call per seed in
 * `CANDIDATE_SEEDS`), in seed order. Scores under the default weights
 * (ascent −0.05, turns −0.5, path ratio +50, construction −100):
 *
 * | # | ascent | turns | path | roadworks | score |
 * | 1 |     20 |    30 |  40% |        0% |   4.0 |
 * | 2 |    300 |     8 |  90% |        0% |  26.0 |
 * | 3 |      5 |    10 |  10% |        0% |  −0.25 |
 * | 4 |    100 |    12 |  50% |       30% | −16.0 |
 * | 5 |     60 |     6 |  70% |        0% |  29.0 |
 *
 * So the server hands the pool over as #5, #2, #1, #3, #4; the sheet reveals
 * the best three, leaving #3 and the roadworks-heavy #4 below the fold, and
 * ranking by "flattest" client-side puts #3 first.
 */
export const loopCandidateSpecs: RouteSpec[] = [
  {
    name: 'twisty canal loop',
    distanceMeters: 12_300,
    durationSeconds: 3_000,
    ascentMeters: 20,
    turnCount: 30,
    pathPercent: 40,
    constructionPercent: 0,
    pointCount: 30,
  },
  {
    name: 'hilly park loop',
    distanceMeters: 15_500,
    durationSeconds: 3_900,
    ascentMeters: 300,
    turnCount: 8,
    pathPercent: 90,
    constructionPercent: 0,
    pointCount: 36,
  },
  {
    name: 'short flat loop',
    distanceMeters: 9_800,
    durationSeconds: 2_400,
    ascentMeters: 5,
    turnCount: 10,
    pathPercent: 10,
    constructionPercent: 0,
    pointCount: 24,
  },
  {
    name: 'roadworks loop',
    distanceMeters: 14_100,
    durationSeconds: 3_600,
    ascentMeters: 100,
    turnCount: 12,
    pathPercent: 50,
    constructionPercent: 30,
    pointCount: 28,
  },
  {
    name: 'easy river loop',
    distanceMeters: 14_800,
    durationSeconds: 3_550,
    ascentMeters: 60,
    turnCount: 6,
    pathPercent: 70,
    constructionPercent: 0,
    pointCount: 32,
  },
]

/**
 * The three alternatives returned for a point-to-point request, in the order
 * ORS hands them over. Scores: A 23.5, B 6.5, C 32.5 — so the app shows
 * C, A, B.
 */
export const alternativeRouteSpecs: RouteSpec[] = [
  {
    name: 'alternative via the canal',
    distanceMeters: 8_200,
    durationSeconds: 2_100,
    ascentMeters: 40,
    turnCount: 9,
    pathPercent: 60,
    constructionPercent: 0,
    pointCount: 20,
  },
  {
    name: 'alternative via the main road',
    distanceMeters: 7_600,
    durationSeconds: 1_980,
    ascentMeters: 120,
    turnCount: 5,
    pathPercent: 30,
    constructionPercent: 0,
    pointCount: 18,
  },
  {
    name: 'alternative via the bike path',
    distanceMeters: 9_100,
    durationSeconds: 2_400,
    ascentMeters: 10,
    turnCount: 14,
    pathPercent: 80,
    constructionPercent: 0,
    pointCount: 22,
  },
]

/**
 * Looks a fixture route up by name, so a spec can say which route it expects
 * to be looking at rather than counting array positions.
 */
export function specNamed(specs: RouteSpec[], name: string): RouteSpec {
  const found = specs.find((spec) => spec.name === name)
  if (!found) {
    throw new Error(`No route fixture named "${name}"`)
  }
  return found
}

/** ORS waytype codes, per `src/server/scoring.ts`. */
const WAYTYPE = {
  street: 3,
  cycleway: 6,
  footway: 7,
  construction: 10,
} as const

/** Which waytype code counts as a dedicated path for the requested profile. */
function pathWaytype(profile: string): number {
  return profile.startsWith('foot') ? WAYTYPE.footway : WAYTYPE.cycleway
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * A closed ring of `pointCount` coordinates (first point repeated last, as a
 * round trip's geometry is), climbing to `ascentMeters` above the base at the
 * halfway point and coming back down — so total ascent is the spec's value and
 * net elevation change is ~0, which is what a loop really looks like.
 */
function loopGeometry(spec: RouteSpec): OrsCoordinate[] {
  const lastIndex = spec.pointCount - 1
  const crest = Math.floor(lastIndex / 2)

  return Array.from({ length: spec.pointCount }, (_, index) => {
    const angle = (2 * Math.PI * index) / lastIndex
    const climbed =
      index <= crest ? index / crest : (lastIndex - index) / (lastIndex - crest)

    return [
      round(LOOP_CENTER.lon + LOOP_RADIUS_DEGREES * Math.cos(angle) * 1.6, 6),
      round(LOOP_CENTER.lat + LOOP_RADIUS_DEGREES * Math.sin(angle), 6),
      round(BASE_ELEVATION_METERS + spec.ascentMeters * climbed, 1),
    ]
  })
}

/**
 * An open line from `start` to `stop`, climbing steadily — so a
 * point-to-point route has a real net elevation change, unlike a loop.
 */
function lineGeometry(
  spec: RouteSpec,
  start: { lat: number; lon: number },
  stop: { lat: number; lon: number },
): OrsCoordinate[] {
  const lastIndex = spec.pointCount - 1

  return Array.from({ length: spec.pointCount }, (_, index) => {
    const progress = index / lastIndex
    // A slight sideways bow, so the three alternatives are visibly different lines.
    const bow = Math.sin(progress * Math.PI) * 0.004

    return [
      round(start.lon + (stop.lon - start.lon) * progress + bow, 6),
      round(start.lat + (stop.lat - start.lat) * progress, 6),
      round(BASE_ELEVATION_METERS + spec.ascentMeters * progress, 1),
    ]
  })
}

const STEP_TYPES = [0, 1, 6, 11, 12, 13]

/** `turnCount` manoeuvre steps, spread evenly over the geometry. */
function steps(
  spec: RouteSpec,
): OrsFeature['properties']['segments'][number]['steps'] {
  const lastIndex = spec.pointCount - 1

  return Array.from({ length: spec.turnCount }, (_, index) => {
    const from = Math.floor((index * lastIndex) / spec.turnCount)
    const to = Math.floor(((index + 1) * lastIndex) / spec.turnCount)

    return {
      distance: round(spec.distanceMeters / spec.turnCount, 1),
      duration: round(spec.durationSeconds / spec.turnCount, 1),
      type: STEP_TYPES[index % STEP_TYPES.length] ?? 0,
      instruction: `Turn onto Fixture Street ${index + 1}`,
      name: `Fixture Street ${index + 1}`,
      way_points: [from, Math.max(to, from)],
    }
  })
}

/**
 * The waytype buckets for a route: dedicated path, roadworks, and ordinary
 * street for whatever is left. `amount` is the percentage of route distance,
 * which is the field the scoring reads; `distance` is the metres it came from.
 */
function waytypeSummary(
  spec: RouteSpec,
  profile: string,
): WaytypeSummaryEntry[] {
  const streetPercent = 100 - spec.pathPercent - spec.constructionPercent
  const buckets: [number, number][] = [
    [pathWaytype(profile), spec.pathPercent],
    [WAYTYPE.construction, spec.constructionPercent],
    [WAYTYPE.street, streetPercent],
  ]

  return buckets
    .filter(([, amount]) => amount > 0)
    .map(([value, amount]) => ({
      value,
      distance: round((spec.distanceMeters * amount) / 100, 1),
      amount,
    }))
}

function bbox(coordinates: OrsCoordinate[]): OrsFeature['bbox'] {
  const lons = coordinates.map(([lon]) => lon)
  const lats = coordinates.map(([, lat]) => lat)
  const elevations = coordinates.map(([, , elevation]) => elevation)

  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.min(...elevations),
    Math.max(...lons),
    Math.max(...lats),
    Math.max(...elevations),
  ]
}

function feature(
  spec: RouteSpec,
  profile: string,
  coordinates: OrsCoordinate[],
): OrsFeature {
  const stepList = steps(spec)
  const summary = waytypeSummary(spec, profile)

  return {
    type: 'Feature',
    bbox: bbox(coordinates),
    geometry: { type: 'LineString', coordinates },
    properties: {
      segments: [
        {
          distance: spec.distanceMeters,
          duration: spec.durationSeconds,
          steps: stepList,
        },
      ],
      extras: {
        waytype: {
          values: summary.map(({ value }, index) => {
            const span = coordinates.length - 1
            const from = Math.floor((index * span) / summary.length)
            const to = Math.floor(((index + 1) * span) / summary.length)
            return [from, to, value] as [number, number, number]
          }),
          summary,
        },
      },
      summary: {
        distance: spec.distanceMeters,
        duration: spec.durationSeconds,
      },
      way_points: [0, coordinates.length - 1],
    },
  }
}

function directionsResponse(features: OrsFeature[]): OrsDirectionsResponse {
  const allCoordinates = features.flatMap((item) => item.geometry.coordinates)

  return {
    type: 'FeatureCollection',
    bbox: bbox(allCoordinates),
    features,
    metadata: {
      attribution: 'openrouteservice.org | OpenStreetMap contributors',
      service: 'routing',
      timestamp: 1_700_000_000_000,
      engine: {
        version: '9.0.0',
        build_date: '2026-01-01T00:00:00Z',
        graph_date: '2026-01-01T00:00:00Z',
      },
    },
  }
}

/**
 * The response to one seeded `round_trip` request. Seeds are 1-based (see
 * `CANDIDATE_SEEDS` in `src/server/ors.ts`); an unseeded request gets the
 * first loop.
 */
export function roundTripResponse(
  profile: string,
  seed: number | undefined,
): OrsDirectionsResponse {
  const index = ((seed ?? 1) - 1) % loopCandidateSpecs.length
  const spec = loopCandidateSpecs[index]
  if (!spec) {
    throw new Error(`No loop fixture for seed ${String(seed)}`)
  }

  return directionsResponse([feature(spec, profile, loopGeometry(spec))])
}

/** The response to an `alternative_routes` request: several routes at once. */
export function alternativeRoutesResponse(
  profile: string,
  start: { lat: number; lon: number },
  stop: { lat: number; lon: number },
): OrsDirectionsResponse {
  return directionsResponse(
    alternativeRouteSpecs.map((spec) =>
      feature(spec, profile, lineGeometry(spec, start, stop)),
    ),
  )
}

/** Places the geocoder knows, keyed by lowercased search text. */
const KNOWN_PLACES: Record<
  string,
  { lat: number; lon: number; label: string; name: string }
> = {
  berlin: {
    lat: 52.52,
    lon: 13.405,
    label: 'Berlin, Germany',
    name: 'Berlin',
  },
  potsdam: {
    lat: 52.3906,
    lon: 13.0645,
    label: 'Potsdam, Brandenburg, Germany',
    name: 'Potsdam',
  },
}

/**
 * A Pelias-shaped `/geocode/search` response, as ORS's geocoder returns:
 * a GeoJSON FeatureCollection whose features carry `properties.label`, with a
 * `geocoding` block describing the query.
 */
export function geocodeResponse(query: string) {
  const place = KNOWN_PLACES[query.trim().toLowerCase()]
  const features = place
    ? [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [place.lon, place.lat],
          },
          properties: {
            id: `fixture/${place.name.toLowerCase()}`,
            gid: `fixture:locality:${place.name.toLowerCase()}`,
            layer: 'locality',
            source: 'fixture',
            source_id: place.name.toLowerCase(),
            name: place.name,
            confidence: 1,
            match_type: 'exact',
            accuracy: 'centroid',
            country: 'Germany',
            country_a: 'DEU',
            region: 'Brandenburg',
            locality: place.name,
            label: place.label,
          },
        },
      ]
    : []

  return {
    geocoding: {
      version: '0.2',
      attribution: 'openrouteservice.org | OpenStreetMap contributors',
      query: { text: query, size: 1, private: false },
      engine: { name: 'Pelias', author: 'Mapzen', version: '1.0' },
      timestamp: 1_700_000_000_000,
    },
    type: 'FeatureCollection' as const,
    features,
    bbox: place ? [place.lon, place.lat, place.lon, place.lat] : undefined,
  }
}

/** The place names the geocode fixture resolves, for the specs to use. */
export const GEOCODABLE_PLACES = {
  start: { query: 'Berlin', label: 'Berlin, Germany' },
  stop: { query: 'Potsdam', label: 'Potsdam, Brandenburg, Germany' },
} as const
