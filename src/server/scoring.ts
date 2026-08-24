/**
 * Pure scoring logic for ranking loop-route candidates returned by ORS.
 *
 * Each function here is intentionally free of network/IO concerns so it can
 * be unit tested with literal, known-good inputs. `ors.ts` is responsible for
 * pulling the raw values out of an ORS response and handing them to these
 * functions.
 */

/** Sums the positive elevation deltas along an ordered list of elevation samples (meters). */
export function computeAscentMeters(elevations: number[]): number {
  let ascent = 0
  for (let i = 1; i < elevations.length; i++) {
    const current = elevations[i] ?? 0
    const previous = elevations[i - 1] ?? 0
    const delta = current - previous
    if (delta > 0) {
      ascent += delta
    }
  }
  return ascent
}

/**
 * Net elevation change over a route: the magnitude of the difference between
 * the last and first elevation samples.
 *
 * ASSUMPTION: for a round-trip loop the start and end point are (near) the
 * same physical location, so the raw signed difference is not a meaningful
 * "uphill vs downhill" signal — it mostly reflects GPS/elevation-model noise
 * plus whichever direction the loop happened to be walked. We report the
 * absolute value as a magnitude: how far off the loop is from truly closing
 * elevation-wise, which is what near-zero-for-loops implies.
 */
export function computeNetElevationChange(elevations: number[]): number {
  if (elevations.length < 2) {
    return 0
  }
  const first = elevations[0] ?? 0
  const last = elevations[elevations.length - 1] ?? 0
  return Math.abs(last - first)
}

/** A single elevation sample with its geographic position, used for gradient calculations. */
export type ElevationPoint = {
  lat: number
  lon: number
  elevation: number
}

const EARTH_RADIUS_METERS = 6_371_000

/** Great-circle distance between two lat/lon points, in meters (haversine formula). */
function haversineDistanceMeters(a: ElevationPoint, b: ElevationPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

/**
 * Steepest single uphill grade (%) over any consecutive pair of points,
 * i.e. max(rise / run * 100) across the route.
 *
 * ASSUMPTION: "steepest climb" means uphill only — descending segments are
 * ignored (not treated as negative grade), mirroring how computeAscentMeters
 * only accumulates positive deltas. Horizontal run between consecutive
 * points is the great-circle (haversine) distance; a zero-distance segment
 * is skipped to avoid a divide-by-zero / infinite grade.
 */
export function computeMaxGradientPercent(points: ElevationPoint[]): number {
  let maxGradient = 0
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]
    if (!previous || !current) {
      continue
    }

    const rise = current.elevation - previous.elevation
    if (rise <= 0) {
      continue
    }

    const run = haversineDistanceMeters(previous, current)
    if (run === 0) {
      continue
    }

    const gradient = (rise / run) * 100
    if (gradient > maxGradient) {
      maxGradient = gradient
    }
  }
  return maxGradient
}

export type OrsSegment = {
  steps: unknown[]
}

/** Raw count of maneuver/turn steps across all segments of an ORS route. */
export function countTurns(segments: OrsSegment[]): number {
  return segments.reduce((total, segment) => total + segment.steps.length, 0)
}

/**
 * A single bucket from ORS's `extra_info.waytype.summary` array: the share of
 * total route distance tagged with a given waytype code.
 */
export type WaytypeSummaryEntry = {
  value: number
  distance: number
  amount: number
}

/**
 * ORS numeric waytype codes, per the openrouteservice extra_info
 * documentation (assumed stable; revisit against a live response if scores
 * look off): 0 Unknown, 1 State Road, 2 Road, 3 Street, 4 Path, 5 Track,
 * 6 Cycleway, 7 Footway, 8 Steps, 9 Ferry, 10 Construction.
 *
 * We only rely on the Cycleway/Footway codes here and the Construction code
 * in `computeConstructionPenalty` below.
 */
const CYCLEWAY_OR_FOOTWAY_WAYTYPES = new Set([6, 7])

/**
 * Share (0..1) of route distance tagged as a dedicated cycleway or footway,
 * derived from ORS `extra_info: ['waytype']`. Returns 0 when the extra_info
 * bucket is absent (e.g. not requested, or ORS omitted it) rather than
 * throwing — a missing signal should never crash scoring, it just means this
 * term contributes nothing.
 */
export function computePathTypeRatio(
  summary: WaytypeSummaryEntry[] | undefined,
): number {
  if (!summary) {
    return 0
  }

  const percentage = summary
    .filter((entry) => CYCLEWAY_OR_FOOTWAY_WAYTYPES.has(entry.value))
    .reduce((total, entry) => total + entry.amount, 0)

  return percentage / 100
}

/** ORS waytype code for "Construction", per the same waytype documentation cited above. */
const CONSTRUCTION_WAYTYPE = 10

/**
 * Share (0..1) of route distance tagged as under construction.
 *
 * ASSUMPTION: ORS does not document a dedicated extra_info key for OSM
 * `construction=*` tags. As a best-effort static-OSM-tag signal, this reuses
 * the `extra_info.waytype` summary bucket (waytype code 10 = Construction).
 * If a live ORS response reveals a more accurate field/key for construction
 * tagging, replace the body of this function only — callers are unaffected.
 * Returns 0 (no penalty) whenever the signal is unavailable.
 */
export function computeConstructionPenalty(
  summary: WaytypeSummaryEntry[] | undefined,
): number {
  if (!summary) {
    return 0
  }

  const percentage = summary
    .filter((entry) => entry.value === CONSTRUCTION_WAYTYPE)
    .reduce((total, entry) => total + entry.amount, 0)

  return percentage / 100
}

export type CandidateMetrics = {
  /** Total climb over the route, in meters. */
  ascentMeters: number
  /**
   * Magnitude of the elevation difference between the route's last and
   * first samples, in meters. Optional so callers/tests that only care
   * about total ascent (issue 002 behavior) don't need to supply it.
   */
  netElevationChangeMeters?: number
  /**
   * Steepest single uphill grade (%) over any segment of the route.
   * Optional for the same reason as netElevationChangeMeters above.
   */
  maxGradientPercent?: number
  /** Raw count of maneuver/turn steps. */
  turnCount: number
  /** Share (0..1) of route distance on a dedicated cycleway/footway. */
  pathTypeRatio: number
  /** Share (0..1) of route distance tagged as under construction. */
  constructionPenalty: number
}

/** Which elevation signal drives the elevation term of the scoring formula (issue 003). */
export type ElevationMetricType = 'ascent' | 'netChange' | 'maxGradient'

/**
 * Default weights for the single weighted-sum scoring formula (issue 002).
 * Not user-adjustable yet — that's a later slice. Chosen to favor flatter,
 * less turn-heavy, more path-dedicated, construction-free loops:
 *
 * - ascentMeters / turnCount: negative weights (raw units), since more climb
 *   or more maneuvers make a loop less pleasant by default.
 * - pathTypeRatio: positive weight, scaled up since the input is a 0..1
 *   ratio and should meaningfully move the score.
 * - constructionPenalty: large negative weight, since a route with active
 *   construction should be strongly deprioritized even at a small ratio.
 */
export const SCORING_WEIGHTS = {
  ascentMeters: -0.05,
  turnCount: -0.5,
  pathTypeRatio: 50,
  constructionPenalty: -100,
} as const

/**
 * Picks the value that feeds the elevation term of the scoring formula,
 * based on the user-selected elevation metric (issue 003). Defaults to
 * total ascent, matching the issue 002 behavior.
 */
function elevationTermValue(
  metrics: CandidateMetrics,
  elevationMetric: ElevationMetricType,
): number {
  switch (elevationMetric) {
    case 'netChange':
      return metrics.netElevationChangeMeters ?? 0
    case 'maxGradient':
      return metrics.maxGradientPercent ?? 0
    case 'ascent':
      return metrics.ascentMeters
  }
}

/**
 * Combines a candidate's metrics into a single comparable score via the
 * weighted-sum formula. `elevationMetric` selects which elevation signal
 * (total ascent, net elevation change, or max gradient) feeds the elevation
 * term; it reuses the same `ascentMeters` weight regardless of which metric
 * is selected, since all three are elevation-flavored signals where "more is
 * worse" and a per-metric weight would add complexity without a documented
 * reason to prefer different magnitudes yet.
 */
export function scoreCandidate(
  metrics: CandidateMetrics,
  elevationMetric: ElevationMetricType = 'ascent',
): number {
  return (
    elevationTermValue(metrics, elevationMetric) *
      SCORING_WEIGHTS.ascentMeters +
    metrics.turnCount * SCORING_WEIGHTS.turnCount +
    metrics.pathTypeRatio * SCORING_WEIGHTS.pathTypeRatio +
    metrics.constructionPenalty * SCORING_WEIGHTS.constructionPenalty
  )
}
