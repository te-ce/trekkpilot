import { describe, expect, it } from 'vitest'

import {
  computeAscentMeters,
  computeConstructionPenalty,
  computePathTypeRatio,
  countTurns,
  scoreCandidate,
  SCORING_WEIGHTS,
} from './scoring'

describe('computeAscentMeters', () => {
  it('sums only the positive elevation deltas along the route', () => {
    // Elevation profile: 100 -> 110 (+10) -> 95 (-15) -> 105 (+10) -> 100 (-5)
    // Total ascent = 10 + 10 = 20
    const elevations = [100, 110, 95, 105, 100]

    expect(computeAscentMeters(elevations)).toBe(20)
  })

  it('returns 0 for a flat or descending-only route', () => {
    expect(computeAscentMeters([100, 90, 80, 70])).toBe(0)
  })

  it('returns 0 when there are fewer than two elevation samples', () => {
    expect(computeAscentMeters([100])).toBe(0)
    expect(computeAscentMeters([])).toBe(0)
  })
})

describe('countTurns', () => {
  it('counts the raw number of maneuver steps across all route segments', () => {
    // Two segments, e.g. outbound leg and return leg of a round trip.
    const segments = [{ steps: [{}, {}, {}] }, { steps: [{}, {}] }]

    expect(countTurns(segments)).toBe(5)
  })

  it('returns 0 when there are no segments', () => {
    expect(countTurns([])).toBe(0)
  })
})

describe('computePathTypeRatio', () => {
  it('sums the distance share of cycleway (6) and footway (7) waytypes', () => {
    // ORS extra_info.waytype.summary entries: { value, distance, amount }
    // where `amount` is already the percentage of total route distance.
    const summary = [
      { value: 2, distance: 6_000, amount: 60 }, // Road
      { value: 6, distance: 2_500, amount: 25 }, // Cycleway
      { value: 7, distance: 1_500, amount: 15 }, // Footway
    ]

    expect(computePathTypeRatio(summary)).toBe(0.4)
  })

  it('returns 0 when waytype extra_info is unavailable', () => {
    expect(computePathTypeRatio(undefined)).toBe(0)
  })

  it('returns 0 when no summary entries match cycleway/footway', () => {
    const summary = [{ value: 2, distance: 10_000, amount: 100 }]
    expect(computePathTypeRatio(summary)).toBe(0)
  })
})

describe('computeConstructionPenalty', () => {
  // ASSUMPTION: ORS does not currently document a dedicated extra_info key
  // for OSM `construction=*` tags. We best-effort this by reusing the same
  // `extra_info.waytype` summary bucket (waytype code 10 = Construction, per
  // the ORS docs) since it is the closest documented static-OSM-tag signal.
  // If ORS ships a more precise field later, only this function needs to
  // change.
  it('returns the distance share tagged as under construction (waytype 10)', () => {
    const summary = [
      { value: 2, distance: 9_000, amount: 90 },
      { value: 10, distance: 1_000, amount: 10 },
    ]

    expect(computeConstructionPenalty(summary)).toBe(0.1)
  })

  it('returns 0 when waytype extra_info is unavailable', () => {
    expect(computeConstructionPenalty(undefined)).toBe(0)
  })
})

describe('scoreCandidate', () => {
  it('combines all metrics via the published weighted-sum formula', () => {
    const metrics = {
      ascentMeters: 200,
      turnCount: 10,
      pathTypeRatio: 0.4,
      constructionPenalty: 0.1,
    }

    // Hand-derived from the exported weight constants, independent of the
    // scoreCandidate implementation: less ascent/turns/construction is
    // better (negative weights), more dedicated path is better (positive
    // weight).
    const expected =
      metrics.ascentMeters * SCORING_WEIGHTS.ascentMeters +
      metrics.turnCount * SCORING_WEIGHTS.turnCount +
      metrics.pathTypeRatio * SCORING_WEIGHTS.pathTypeRatio +
      metrics.constructionPenalty * SCORING_WEIGHTS.constructionPenalty

    expect(scoreCandidate(metrics)).toBeCloseTo(expected)
  })

  it('penalizes construction-heavy routes relative to an otherwise identical clean route', () => {
    const clean = scoreCandidate({
      ascentMeters: 50,
      turnCount: 5,
      pathTypeRatio: 0.5,
      constructionPenalty: 0,
    })
    const underConstruction = scoreCandidate({
      ascentMeters: 50,
      turnCount: 5,
      pathTypeRatio: 0.5,
      constructionPenalty: 0.5,
    })

    expect(underConstruction).toBeLessThan(clean)
  })
})
