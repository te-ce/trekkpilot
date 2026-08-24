import { targetDistanceMeters, type ActivityType } from '#/lib/activity'
import { orsBaseUrl } from '#/server/orsConfig'
import {
  computeAscentMeters,
  computeConstructionPenalty,
  computeMaxGradientPercent,
  computeNetElevationChange,
  computePathTypeRatio,
  countTurns,
  scoreCandidate,
  type CandidateMetrics,
  type ElevationMetricType,
  type OrsSegment,
  type WaytypeSummaryEntry,
} from '#/server/scoring'

export type GeoPoint = { lat: number; lon: number }

const ORS_PROFILE: Record<ActivityType, string> = {
  cycling: 'cycling-regular',
  trekking: 'foot-walking',
}

export type RoundTripRequestInput = {
  activity: ActivityType
  start: GeoPoint
  distanceMeters: number
  /** Varies the loop ORS generates for the same start/distance, so repeated calls yield distinct candidates. */
  seed?: number
}

export type OrsRequest = {
  url: string
  body: {
    coordinates: [number, number][]
    /** Requests elevation as a 3rd coordinate value, needed to compute ascent. */
    elevation: true
    /**
     * Requests the `waytype` extra_info bucket, used for both the
     * cycleway/footway path-type ratio and (best-effort) the
     * construction-tag penalty. See scoring.ts for the assumptions behind
     * reusing this single bucket for both signals.
     */
    extra_info: ['waytype']
    options: {
      round_trip: {
        length: number
        points: number
        seed?: number
      }
    }
  }
}

export function buildRoundTripRequest({
  activity,
  start,
  distanceMeters,
  seed,
}: RoundTripRequestInput): OrsRequest {
  const profile = ORS_PROFILE[activity]

  return {
    url: `${orsBaseUrl()}/v2/directions/${profile}/geojson`,
    body: {
      coordinates: [[start.lon, start.lat]],
      elevation: true,
      extra_info: ['waytype'],
      options: {
        round_trip: {
          length: distanceMeters,
          points: 3,
          ...(seed === undefined ? {} : { seed }),
        },
      },
    },
  }
}

export type AlternativeRoutesRequestInput = {
  activity: ActivityType
  start: GeoPoint
  stop: GeoPoint
}

export type AlternativeRoutesRequest = {
  url: string
  body: {
    coordinates: [number, number][]
    elevation: true
    extra_info: ['waytype']
    /**
     * Requests ORS's alternative-routes feature between two fixed points
     * (point-to-point mode, issue 004), as opposed to `round_trip`'s
     * endpoint-discovery loops. `target_count` caps how many alternatives ORS
     * tries to generate; up to that many scored candidates come back from
     * fetchPointToPointRouteCandidates below.
     *
     * ASSUMPTION: `share_factor`/`weight_factor` values are ORS's documented
     * defaults for meaningfully distinct alternatives, not verified against a
     * live response — revisit if ORS rejects the request or the alternatives
     * look degenerate.
     */
    alternative_routes: {
      target_count: number
      share_factor: number
      weight_factor: number
    }
  }
}

const ALTERNATIVE_ROUTES_TARGET_COUNT = 5

/**
 * Builds a directions request between two fixed points asking ORS for
 * alternative routes (point-to-point mode, issue 004). Unlike round_trip,
 * this targets a specific destination rather than discovering an endpoint,
 * so only a single ORS call is needed instead of several seeded calls.
 */
export function buildAlternativeRoutesRequest({
  activity,
  start,
  stop,
}: AlternativeRoutesRequestInput): AlternativeRoutesRequest {
  const profile = ORS_PROFILE[activity]

  return {
    url: `${orsBaseUrl()}/v2/directions/${profile}/geojson`,
    body: {
      coordinates: [
        [start.lon, start.lat],
        [stop.lon, stop.lat],
      ],
      elevation: true,
      extra_info: ['waytype'],
      alternative_routes: {
        target_count: ALTERNATIVE_ROUTES_TARGET_COUNT,
        share_factor: 0.6,
        weight_factor: 1.4,
      },
    },
  }
}

export type LoopRouteInput = {
  activity: ActivityType
  start: GeoPoint
  durationMinutes: number
  /** Which elevation signal drives scoring/display (issue 003). Defaults to 'ascent'. */
  elevationMetric?: ElevationMetricType
}

export type LoopRouteResult = {
  /** [lat, lon] pairs describing the closed loop, in order. */
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

function requireApiKey(): string {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    throw new Error('ORS_API_KEY is not configured on the server')
  }
  return apiKey
}

/**
 * POSTs a request (round_trip or alternative_routes) to ORS and parses the
 * JSON response as `T`. `response.json()` is typed `Promise<any>` by
 * lib.dom, so the generic return type is satisfied without needing an `as`
 * assertion at call sites.
 */
async function postOrsRequest<T>(
  { url, body }: { url: string; body: unknown },
  apiKey: string,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `ORS request failed with status ${response.status}: ${detail}`,
    )
  }

  return response.json()
}

type SingleFeatureResponse = {
  features: {
    geometry: { coordinates: [number, number, number?][] }
    properties: { summary: { distance: number; duration: number } }
  }[]
}

export async function fetchLoopRoute({
  activity,
  start,
  durationMinutes,
}: LoopRouteInput): Promise<LoopRouteResult> {
  const apiKey = requireApiKey()
  const distanceMeters = targetDistanceMeters(activity, durationMinutes)
  const request = buildRoundTripRequest({ activity, start, distanceMeters })

  const geojson = await postOrsRequest<SingleFeatureResponse>(request, apiKey)
  const feature = geojson.features[0]
  if (!feature) {
    throw new Error('ORS response did not include a route feature')
  }
  const coordinates: [number, number][] = feature.geometry.coordinates.map(
    ([lon, lat]) => [lat, lon],
  )

  return {
    coordinates,
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
  }
}

export type LoopRouteCandidate = LoopRouteResult & {
  metrics: CandidateMetrics
  score: number
}

/**
 * Seeds passed to ORS's `options.round_trip.seed` to force distinct loops
 * for the same start point and target distance. The number of seeds is the
 * number of candidates fetched; all are scored and returned to the caller
 * (sorted best-first), letting the client show a few and reveal the rest on
 * demand ("load more") without a second ORS call. Arbitrary but fixed for
 * reproducibility.
 */
const CANDIDATE_SEEDS = [1, 2, 3, 4, 5]

type OrsFeature = {
  geometry: { coordinates: [number, number, number?][] }
  properties: {
    summary: { distance: number; duration: number }
    segments: OrsSegment[]
    extras?: { waytype?: { summary: WaytypeSummaryEntry[] } }
  }
}

function metricsFromFeature(feature: OrsFeature): CandidateMetrics {
  const elevations = feature.geometry.coordinates.map(
    ([, , elevation]) => elevation ?? 0,
  )
  const elevationPoints = feature.geometry.coordinates.map(
    ([lon, lat, elevation]) => ({ lat, lon, elevation: elevation ?? 0 }),
  )
  const waytypeSummary = feature.properties.extras?.waytype?.summary

  return {
    ascentMeters: computeAscentMeters(elevations),
    netElevationChangeMeters: computeNetElevationChange(elevations),
    maxGradientPercent: computeMaxGradientPercent(elevationPoints),
    turnCount: countTurns(feature.properties.segments),
    pathTypeRatio: computePathTypeRatio(waytypeSummary),
    constructionPenalty: computeConstructionPenalty(waytypeSummary),
  }
}

/**
 * Turns a single ORS route feature into a scored candidate. Shared by both
 * the round_trip (loop) and alternative_routes (point-to-point) code paths
 * below, since both hand back the same GeoJSON feature shape and score it
 * identically.
 */
function featureToCandidate(
  feature: OrsFeature,
  elevationMetric: ElevationMetricType,
): LoopRouteCandidate {
  const coordinates: [number, number][] = feature.geometry.coordinates.map(
    ([lon, lat]) => [lat, lon],
  )
  const metrics = metricsFromFeature(feature)

  return {
    coordinates,
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
    metrics,
    score: scoreCandidate(metrics, elevationMetric),
  }
}

/**
 * Fetches several round-trip loop candidates from ORS for the same start
 * point and target duration (varying `options.round_trip.seed` per call so
 * ORS generates distinct loops), scores each one via the weighted-sum
 * formula in scoring.ts, and returns all of them sorted best-first.
 */
export async function fetchLoopRouteCandidates({
  activity,
  start,
  durationMinutes,
  elevationMetric = 'ascent',
}: LoopRouteInput): Promise<LoopRouteCandidate[]> {
  const apiKey = requireApiKey()
  const distanceMeters = targetDistanceMeters(activity, durationMinutes)

  const candidates = await Promise.all(
    CANDIDATE_SEEDS.map(async (seed) => {
      const request = buildRoundTripRequest({
        activity,
        start,
        distanceMeters,
        seed,
      })
      const geojson = await postOrsRequest<{ features: OrsFeature[] }>(
        request,
        apiKey,
      )
      const feature = geojson.features[0]
      if (!feature) {
        throw new Error('ORS response did not include a route feature')
      }

      return featureToCandidate(feature, elevationMetric)
    }),
  )

  return candidates.sort((a, b) => b.score - a.score)
}

export type PointToPointRouteInput = {
  activity: ActivityType
  start: GeoPoint
  stop: GeoPoint
  /** Which elevation signal drives scoring/display (issue 003). Defaults to 'ascent'. */
  elevationMetric?: ElevationMetricType
}

/**
 * A single scored point-to-point route alternative between a fixed start and
 * stop point. Shares its shape with LoopRouteCandidate (same coordinates /
 * metrics / score fields) so the UI can reuse the same candidate-list
 * rendering for both modes; only the semantics of `coordinates` differ (an
 * open outbound leg here, vs. a closed loop for round_trip). Return-trip
 * routing is explicitly out of scope (issue 004) — only the outbound leg
 * above is fetched/scored.
 */
export type PointToPointRouteCandidate = LoopRouteCandidate

/**
 * Fetches alternative routes from ORS between two fixed points
 * (point-to-point mode, issue 004), scores each one via the same
 * weighted-sum formula used for loop candidates, and returns all of them
 * sorted best-first. Unlike fetchLoopRouteCandidates, this needs only a
 * single ORS call since `alternative_routes` returns several distinct routes
 * per request.
 */
export async function fetchPointToPointRouteCandidates({
  activity,
  start,
  stop,
  elevationMetric = 'ascent',
}: PointToPointRouteInput): Promise<PointToPointRouteCandidate[]> {
  const apiKey = requireApiKey()
  const request = buildAlternativeRoutesRequest({ activity, start, stop })

  const geojson = await postOrsRequest<{ features: OrsFeature[] }>(
    request,
    apiKey,
  )
  if (geojson.features.length === 0) {
    throw new Error('ORS response did not include a route feature')
  }

  return geojson.features
    .map((feature) => featureToCandidate(feature, elevationMetric))
    .sort((a, b) => b.score - a.score)
}
