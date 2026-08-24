import { targetDistanceMeters, type ActivityType } from '#/lib/activity'
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
    url: `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
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
 * POSTs a round_trip request to ORS and parses the JSON response as `T`.
 * `response.json()` is typed `Promise<any>` by lib.dom, so the generic
 * return type is satisfied without needing an `as` assertion at call sites.
 */
async function postOrsRequest<T>(
  { url, body }: OrsRequest,
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
 * number of candidates fetched; the top 3 by score are returned to the
 * caller. Arbitrary but fixed for reproducibility.
 */
const CANDIDATE_SEEDS = [1, 2, 3, 4, 5]

const TOP_CANDIDATE_COUNT = 3

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
 * Fetches several round-trip loop candidates from ORS for the same start
 * point and target duration (varying `options.round_trip.seed` per call so
 * ORS generates distinct loops), scores each one via the weighted-sum
 * formula in scoring.ts, and returns the top 3 sorted best-first.
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

      const coordinates: [number, number][] = feature.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon],
      )
      const metrics = metricsFromFeature(feature)

      const candidate: LoopRouteCandidate = {
        coordinates,
        distanceMeters: feature.properties.summary.distance,
        durationSeconds: feature.properties.summary.duration,
        metrics,
        score: scoreCandidate(metrics, elevationMetric),
      }
      return candidate
    }),
  )

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_CANDIDATE_COUNT)
}
