import { describe, expect, it } from 'vitest'

import type { LoopRouteCandidate } from '#/server/ors'
import type { CandidateMetrics } from '#/server/scoring'

import {
  formatDistance,
  formatDuration,
  type RankBy,
  rankCandidates,
  ROUTE_COLORS,
} from './ranking'

function makeCandidate(
  metrics: Partial<CandidateMetrics> = {},
  overrides: Partial<LoopRouteCandidate> = {},
): LoopRouteCandidate {
  return {
    coordinates: [
      [52.52, 13.405],
      [52.52, 13.405],
    ],
    distanceMeters: 10_000,
    durationSeconds: 7_200,
    score: 0,
    ...overrides,
    metrics: {
      ascentMeters: 100,
      maxGradientPercent: 5,
      turnCount: 20,
      pathTypeRatio: 0.5,
      constructionPenalty: 0,
      ...metrics,
    },
  }
}

/** The originalIndex order a ranking produced, which is what ordering assertions care about. */
function order(ranked: { originalIndex: number }[]): number[] {
  return ranked.map((entry) => entry.originalIndex)
}

describe('formatDistance', () => {
  it('shows kilometres with one decimal at or above a kilometre', () => {
    expect(formatDistance(15200)).toBe('15.2 km')
  })

  it('shows whole metres below a kilometre', () => {
    expect(formatDistance(850)).toBe('850 m')
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes past the hour', () => {
    expect(formatDuration(3660)).toBe('1 h 1 min')
  })

  it('shows only minutes under an hour', () => {
    expect(formatDuration(3480)).toBe('58 min')
  })
})

describe('rankCandidates ordering', () => {
  it('ranks flat by least total ascent', () => {
    const candidates = [
      makeCandidate({ ascentMeters: 300 }),
      makeCandidate({ ascentMeters: 50 }),
      makeCandidate({ ascentMeters: 120 }),
    ]

    expect(order(rankCandidates(candidates, 'flat'))).toEqual([1, 2, 0])
  })

  it('ranks gentle by shallowest max gradient, treating a missing gradient as zero', () => {
    const withoutGradient = makeCandidate()
    const candidates = [
      makeCandidate({ maxGradientPercent: 9 }),
      makeCandidate({ maxGradientPercent: 3 }),
      {
        ...withoutGradient,
        metrics: {
          ascentMeters: withoutGradient.metrics.ascentMeters,
          turnCount: withoutGradient.metrics.turnCount,
          pathTypeRatio: withoutGradient.metrics.pathTypeRatio,
          constructionPenalty: withoutGradient.metrics.constructionPenalty,
        },
      },
    ]

    expect(order(rankCandidates(candidates, 'gentle'))).toEqual([2, 1, 0])
  })

  it('ranks paths by most dedicated cycleway/footway', () => {
    const candidates = [
      makeCandidate({ pathTypeRatio: 0.1 }),
      makeCandidate({ pathTypeRatio: 0.9 }),
      makeCandidate({ pathTypeRatio: 0.4 }),
    ]

    expect(order(rankCandidates(candidates, 'paths'))).toEqual([1, 2, 0])
  })

  it('ranks turns by fewest turns', () => {
    const candidates = [
      makeCandidate({ turnCount: 40 }),
      makeCandidate({ turnCount: 5 }),
      makeCandidate({ turnCount: 12 }),
    ]

    expect(order(rankCandidates(candidates, 'turns'))).toEqual([1, 2, 0])
  })

  it('ranks balanced by the shared scoring formula, so a strictly better candidate wins', () => {
    // Candidate 1 is better on every scored term: less climb, fewer turns,
    // more dedicated path, no roadworks. It must come first under any sane
    // weighting of the shared formula.
    const candidates = [
      makeCandidate({
        ascentMeters: 400,
        turnCount: 60,
        pathTypeRatio: 0.1,
        constructionPenalty: 0.3,
      }),
      makeCandidate({
        ascentMeters: 40,
        turnCount: 6,
        pathTypeRatio: 0.8,
        constructionPenalty: 0,
      }),
    ]

    expect(order(rankCandidates(candidates, 'balanced'))).toEqual([1, 0])
  })

  it('numbers ranks from 1 and keeps a candidate reachable by its original index', () => {
    const candidates = [
      makeCandidate({ turnCount: 40 }),
      makeCandidate({ turnCount: 5 }),
    ]

    const ranked = rankCandidates(candidates, 'turns')

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2])
    expect(ranked[0]?.candidate).toBe(candidates[1])
    expect(ranked[0]?.originalIndex).toBe(1)
  })

  it('is stable on ties and never mutates the input array', () => {
    const candidates = [
      makeCandidate({ turnCount: 10 }),
      makeCandidate({ turnCount: 10 }),
      makeCandidate({ turnCount: 10 }),
    ]
    const snapshot = [...candidates]

    expect(order(rankCandidates(candidates, 'turns'))).toEqual([0, 1, 2])
    expect(candidates).toEqual(snapshot)
  })

  it('handles an empty candidate set', () => {
    expect(rankCandidates([], 'balanced')).toEqual([])
  })
})

/** The reason string for the candidate at a given original index. */
function reasonFor(
  candidates: LoopRouteCandidate[],
  originalIndex: number,
): string {
  const ranked = rankCandidates(candidates, 'balanced')
  return (
    ranked.find((entry) => entry.originalIndex === originalIndex)?.reason ?? ''
  )
}

describe('rankCandidates reasons', () => {
  it('names the single measure a candidate leads on', () => {
    const candidates = [
      makeCandidate({ ascentMeters: 20, turnCount: 30, pathTypeRatio: 0.2 }),
      makeCandidate({ ascentMeters: 200, turnCount: 10, pathTypeRatio: 0.2 }),
      makeCandidate({ ascentMeters: 300, turnCount: 40, pathTypeRatio: 0.9 }),
    ]

    expect(reasonFor(candidates, 0)).toMatch(/flattest/i)
    expect(reasonFor(candidates, 0)).not.toMatch(/turn/i)
    expect(reasonFor(candidates, 1)).toMatch(/turn/i)
    expect(reasonFor(candidates, 2)).toMatch(/path/i)
  })

  it('joins two leads with ", and "', () => {
    const candidates = [
      makeCandidate({ ascentMeters: 20, pathTypeRatio: 0.9, turnCount: 30 }),
      makeCandidate({ ascentMeters: 200, pathTypeRatio: 0.1, turnCount: 10 }),
    ]

    const reason = reasonFor(candidates, 0)
    expect(reason).toContain(', and ')
    expect(reason).toMatch(/flattest/i)
    expect(reason).toMatch(/path/i)
  })

  it('falls back to an honest sentence when a candidate leads on nothing', () => {
    const candidates = [
      makeCandidate(
        {
          ascentMeters: 100,
          maxGradientPercent: 5,
          turnCount: 20,
          pathTypeRatio: 0.5,
        },
        { distanceMeters: 10_000 },
      ),
      makeCandidate(
        {
          ascentMeters: 10,
          maxGradientPercent: 1,
          turnCount: 2,
          pathTypeRatio: 0.9,
        },
        { distanceMeters: 5_000 },
      ),
    ]

    const reason = reasonFor(candidates, 0)
    expect(reason).not.toBe('')
    expect(reason).not.toMatch(/flattest|fewest|most|shortest|gentlest/i)
  })

  it('calls out roadworks when a candidate carries a construction penalty', () => {
    const candidates = [
      makeCandidate({ constructionPenalty: 0.2, ascentMeters: 20 }),
      makeCandidate({ constructionPenalty: 0, ascentMeters: 200 }),
    ]

    expect(reasonFor(candidates, 0)).toMatch(/roadworks/i)
    expect(reasonFor(candidates, 1)).not.toMatch(/roadworks/i)
  })

  it('starts every reason with a capital letter', () => {
    const candidates = [
      makeCandidate({ ascentMeters: 20 }),
      makeCandidate({ ascentMeters: 200, constructionPenalty: 0.4 }),
    ]

    for (const entry of rankCandidates(candidates, 'balanced')) {
      expect(entry.reason[0]).toBe(entry.reason[0]?.toUpperCase())
    }
  })
})

describe('ROUTE_COLORS', () => {
  it('is the three-color moss / slate blue / ochre palette', () => {
    expect([...ROUTE_COLORS]).toEqual(['#0B6E4F', '#2F6690', '#A9700F'])
  })

  it('keeps a candidate on the same color when the ranking changes', () => {
    const candidates = [
      makeCandidate({ ascentMeters: 300, turnCount: 5 }),
      makeCandidate({ ascentMeters: 50, turnCount: 40 }),
    ]

    const colorByCandidate = (rankBy: RankBy) =>
      new Map(
        rankCandidates(candidates, rankBy).map((entry) => [
          entry.candidate,
          ROUTE_COLORS[entry.originalIndex % ROUTE_COLORS.length],
        ]),
      )

    const flat = colorByCandidate('flat')
    const turns = colorByCandidate('turns')

    // Different rank order...
    expect(order(rankCandidates(candidates, 'flat'))).not.toEqual(
      order(rankCandidates(candidates, 'turns')),
    )
    // ...but each candidate keeps its color.
    for (const candidate of candidates) {
      expect(flat.get(candidate)).toBe(turns.get(candidate))
    }
  })
})
