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
  /** Raw count of maneuver/turn steps. */
  turnCount: number
  /** Share (0..1) of route distance on a dedicated cycleway/footway. */
  pathTypeRatio: number
  /** Share (0..1) of route distance tagged as under construction. */
  constructionPenalty: number
}

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

/** Combines a candidate's metrics into a single comparable score via the weighted-sum formula. */
export function scoreCandidate(metrics: CandidateMetrics): number {
  return (
    metrics.ascentMeters * SCORING_WEIGHTS.ascentMeters +
    metrics.turnCount * SCORING_WEIGHTS.turnCount +
    metrics.pathTypeRatio * SCORING_WEIGHTS.pathTypeRatio +
    metrics.constructionPenalty * SCORING_WEIGHTS.constructionPenalty
  )
}
