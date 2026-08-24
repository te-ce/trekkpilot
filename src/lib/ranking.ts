/**
 * Client-side re-ranking and display formatting for loop-route candidates.
 *
 * Every metric the ranking needs already lives on each candidate, so changing
 * what the user optimizes for is a pure re-sort — never a refetch. This module
 * is deliberately free of IO so it can be unit tested with literal inputs.
 */

import type { LoopRouteCandidate } from '#/server/ors'
import { scoreCandidate, type ElevationMetricType } from '#/server/scoring'

/** What the user is currently optimizing for. */
export type RankBy = 'balanced' | 'flat' | 'gentle' | 'paths' | 'turns'

export type RankedCandidate = {
  candidate: LoopRouteCandidate
  /** 1-based position in the current ranking. */
  rank: number
  /** Index in the original unsorted candidates array; stable id for keys/exports. */
  originalIndex: number
  /** Short human sentence saying why this route stands out, e.g. "Flattest, and most bike path". */
  reason: string
}

/**
 * Per-route polyline colors: moss, slate blue, ochre, plum, terracotta.
 *
 * Literal hex rather than CSS variables because Leaflet polylines take literal
 * colors, and the OSM tile layer stays light regardless of the app theme.
 * Index by `originalIndex % ROUTE_COLORS.length` so a candidate keeps the same
 * color when the ranking changes. Sized to match the candidate pool (up to 5)
 * so colors don't repeat when "load more" reveals the rest.
 */
export const ROUTE_COLORS: readonly string[] = [
  '#0B6E4F',
  '#2F6690',
  '#A9700F',
  '#7B4B94',
  '#B5502E',
]

/**
 * The sort key for each ranking mode, plus whether bigger is better. Reusing
 * `scoreCandidate` for 'balanced' keeps the weighted-sum formula in one place.
 */
const SORT_KEYS: Record<
  RankBy,
  {
    value: (
      candidate: LoopRouteCandidate,
      elevationMetric: ElevationMetricType,
    ) => number
    higherIsBetter: boolean
  }
> = {
  balanced: {
    value: (candidate, elevationMetric) =>
      scoreCandidate(candidate.metrics, elevationMetric),
    higherIsBetter: true,
  },
  flat: {
    value: (candidate) => candidate.metrics.ascentMeters,
    higherIsBetter: false,
  },
  gentle: {
    value: (candidate) => candidate.metrics.maxGradientPercent ?? 0,
    higherIsBetter: false,
  },
  paths: {
    value: (candidate) => candidate.metrics.pathTypeRatio,
    higherIsBetter: true,
  },
  turns: {
    value: (candidate) => candidate.metrics.turnCount,
    higherIsBetter: false,
  },
}

/**
 * The superlatives a candidate can earn, in the order they're offered to the
 * reader. A candidate earns one only by being the strict, sole leader on that
 * measure within the current set — a tie tells the reader nothing useful.
 */
const SUPERLATIVES: {
  phrase: string
  value: (candidate: LoopRouteCandidate) => number
  higherIsBetter: boolean
}[] = [
  {
    phrase: 'flattest',
    value: (candidate) => candidate.metrics.ascentMeters,
    higherIsBetter: false,
  },
  {
    phrase: 'fewest turns',
    value: (candidate) => candidate.metrics.turnCount,
    higherIsBetter: false,
  },
  {
    phrase: 'most bike path',
    value: (candidate) => candidate.metrics.pathTypeRatio,
    higherIsBetter: true,
  },
  {
    phrase: 'gentlest climbs',
    value: (candidate) => candidate.metrics.maxGradientPercent ?? 0,
    higherIsBetter: false,
  },
  {
    phrase: 'shortest',
    value: (candidate) => candidate.distanceMeters,
    higherIsBetter: false,
  },
]

const FALLBACK_REASON = 'Middle ground on every measure'
const ROADWORKS_PHRASE = 'some roadworks'
const MAX_CLAUSES = 2

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * A short sentence saying why this candidate stands out relative to the others
 * in the same set, e.g. "Flattest, and most bike path". Roadworks take the
 * last clause when present, since they are the one thing a walker most wants
 * warned about.
 */
function buildReason(
  candidate: LoopRouteCandidate,
  candidates: LoopRouteCandidate[],
): string {
  const hasRoadworks = candidate.metrics.constructionPenalty > 0

  // Superlatives are comparative: with a single route there is nothing to
  // stand out from, so only the roadworks warning (or the fallback) applies.
  const leads = (candidates.length < 2 ? [] : SUPERLATIVES)
    .filter(({ value, higherIsBetter }) => {
      const own = value(candidate)
      return candidates.every((other) => {
        if (other === candidate) {
          return true
        }
        const theirs = value(other)
        return higherIsBetter ? own > theirs : own < theirs
      })
    })
    .map(({ phrase }) => phrase)

  const clauses = leads.slice(0, hasRoadworks ? MAX_CLAUSES - 1 : MAX_CLAUSES)
  if (hasRoadworks) {
    clauses.push(ROADWORKS_PHRASE)
  }

  if (clauses.length === 0) {
    return FALLBACK_REASON
  }
  return capitalize(clauses.join(', and '))
}

/**
 * Re-ranks candidates for the selected optimization. Pure: the input array is
 * never mutated, and ties keep their original relative order.
 *
 * `elevationMetric` (issue 003) selects which elevation signal feeds the
 * elevation term of the 'balanced' score; the other modes sort on a single
 * explicit measure and ignore it. Note the split of responsibility: the server
 * scores and sorts the full candidate pool, and this function re-ranks
 * whichever candidates the client currently has on the client without
 * refetching.
 */
export function rankCandidates(
  candidates: LoopRouteCandidate[],
  rankBy: RankBy,
  elevationMetric: ElevationMetricType = 'ascent',
): RankedCandidate[] {
  const { value, higherIsBetter } = SORT_KEYS[rankBy]

  return candidates
    .map((candidate, originalIndex) => ({ candidate, originalIndex }))
    .sort((a, b) => {
      const delta =
        value(a.candidate, elevationMetric) -
        value(b.candidate, elevationMetric)
      return higherIsBetter ? -delta : delta
    })
    .map((entry, position) => ({
      candidate: entry.candidate,
      rank: position + 1,
      originalIndex: entry.originalIndex,
      reason: buildReason(entry.candidate, candidates),
    }))
}

/** Formats a distance in meters for display: km with one decimal, m below a km. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

/** Formats a duration in seconds for display, rounded to whole minutes. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} min`
  }
  return `${hours} h ${minutes} min`
}
