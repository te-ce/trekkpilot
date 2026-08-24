import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildAlternativeRoutesRequest,
  buildRoundTripRequest,
  fetchLoopRoute,
  fetchLoopRouteCandidates,
  fetchPointToPointRouteCandidates,
} from './ors'

function orsFeature({
  coordinates = [
    [13.405, 52.52, 30],
    [13.41, 52.525, 35],
    [13.405, 52.52, 30],
  ],
  distance = 15_200,
  duration = 3_600,
  steps = [{}, {}],
  waytypeSummary,
}: {
  coordinates?: [number, number, number][]
  distance?: number
  duration?: number
  steps?: unknown[]
  waytypeSummary?: { value: number; distance: number; amount: number }[]
} = {}) {
  return {
    features: [
      {
        geometry: { coordinates },
        properties: {
          summary: { distance, duration },
          segments: [{ steps }],
          ...(waytypeSummary
            ? { extras: { waytype: { summary: waytypeSummary } } }
            : {}),
        },
      },
    ],
  }
}

const sampleOrsResponse = {
  features: [
    {
      geometry: {
        coordinates: [
          [13.405, 52.52],
          [13.41, 52.525],
          [13.405, 52.52],
        ],
      },
      properties: {
        summary: {
          distance: 15_200,
          duration: 3_600,
        },
      },
    },
  ],
}

describe('buildRoundTripRequest', () => {
  it('builds a cycling round_trip request for the given start point and distance', () => {
    const request = buildRoundTripRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      distanceMeters: 15_000,
    })

    expect(request.url).toBe(
      'https://api.openrouteservice.org/v2/directions/cycling-regular/geojson',
    )
    expect(request.body).toEqual({
      coordinates: [[13.405, 52.52]],
      elevation: true,
      extra_info: ['waytype'],
      options: {
        round_trip: {
          length: 15_000,
          points: 3,
        },
      },
    })
  })

  it('targets an overridden ORS host when ORS_BASE_URL is set, so tests can point at a fixture server', () => {
    vi.stubEnv('ORS_BASE_URL', 'http://127.0.0.1:4319')

    const request = buildRoundTripRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      distanceMeters: 15_000,
    })

    expect(request.url).toBe(
      'http://127.0.0.1:4319/v2/directions/cycling-regular/geojson',
    )

    vi.unstubAllEnvs()
  })

  it('builds a trekking round_trip request using the foot-walking profile', () => {
    const request = buildRoundTripRequest({
      activity: 'trekking',
      start: { lat: 48.2, lon: 16.37 },
      distanceMeters: 4_500,
    })

    expect(request.url).toBe(
      'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
    )
  })

  it('includes a seed in options.round_trip when one is given, to vary the generated loop', () => {
    const request = buildRoundTripRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      distanceMeters: 15_000,
      seed: 42,
    })

    expect(request.body.options.round_trip.seed).toBe(42)
  })

  it('omits the seed field when none is given', () => {
    const request = buildRoundTripRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      distanceMeters: 15_000,
    })

    expect(request.body.options.round_trip.seed).toBeUndefined()
  })
})

describe('fetchLoopRouteCandidates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('requests several round-trip candidates from ORS using distinct seeds', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(orsFeature()),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchLoopRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    })

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)

    const seeds = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init.body).options.round_trip.seed,
    )
    expect(new Set(seeds).size).toBe(seeds.length)
    expect(seeds.every((seed) => typeof seed === 'number')).toBe(true)
  })

  it('uses the selected elevation metric to score candidates instead of total ascent', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            orsFeature({
              // Net change: |100 - 100| = 0. Ascent would be 30 (100->130->100).
              coordinates: [
                [13.405, 52.52, 100],
                [13.41, 52.525, 130],
                [13.405, 52.52, 100],
              ],
              steps: [{}, {}, {}],
              waytypeSummary: [
                { value: 2, distance: 6_000, amount: 60 },
                { value: 6, distance: 4_000, amount: 40 },
              ],
            }),
          ),
      }),
    )

    const candidates = await fetchLoopRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
      elevationMetric: 'netChange',
    })
    const top = candidates[0]
    expect(top).toBeDefined()

    expect(top?.metrics.netElevationChangeMeters).toBe(0)
    expect(top?.score).toBeCloseTo(3 * -0.5 + 0.4 * 50)
  })

  it('computes ascent, turn count and path-type ratio metrics per candidate from the ORS response', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            orsFeature({
              coordinates: [
                [13.405, 52.52, 100],
                [13.41, 52.525, 130],
                [13.405, 52.52, 100],
              ],
              steps: [{}, {}, {}],
              waytypeSummary: [
                { value: 2, distance: 6_000, amount: 60 },
                { value: 6, distance: 4_000, amount: 40 },
              ],
            }),
          ),
      }),
    )

    const candidates = await fetchLoopRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    })
    const top = candidates[0]
    expect(top).toBeDefined()

    expect(top?.metrics.ascentMeters).toBe(30)
    expect(top?.metrics.turnCount).toBe(3)
    expect(top?.metrics.pathTypeRatio).toBe(0.4)
    expect(top?.metrics.constructionPenalty).toBe(0)
    expect(top?.metrics.netElevationChangeMeters).toBe(0)
    // ~650m horizontal run between the two distinct points, +30m rise.
    expect(top?.metrics.maxGradientPercent).toBeCloseTo(4.61, 1)
    expect(top?.score).toBeCloseTo(30 * -0.05 + 3 * -0.5 + 0.4 * 50)
  })

  it('returns only the top 3 candidates, sorted best score first', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    const responses = [
      orsFeature({ steps: [{}, {}, {}, {}, {}] }), // worst: many turns
      orsFeature({ steps: [{}] }), // best: fewest turns
      orsFeature({ steps: [{}, {}] }),
      orsFeature({ steps: [{}, {}, {}] }),
      orsFeature({ steps: [{}, {}, {}, {}] }),
    ]
    const fetchMock = vi.fn()
    for (const feature of responses) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(feature),
      })
    }
    vi.stubGlobal('fetch', fetchMock)

    const candidates = await fetchLoopRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    })

    expect(candidates).toHaveLength(3)
    const scores = candidates.map((candidate) => candidate.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    // Best candidate corresponds to the response with the fewest turn steps.
    expect(candidates[0]?.metrics.turnCount).toBe(1)
  })
})

function orsAlternativesResponse({
  count = 2,
}: {
  count?: number
} = {}) {
  const stepsByIndex = [[{}, {}], [{}, {}, {}, {}], [{}]]
  return {
    features: Array.from({ length: count }, (_, index) => ({
      geometry: {
        coordinates: [
          [13.405, 52.52, 30],
          [13.41, 52.525, 40],
        ],
      },
      properties: {
        summary: { distance: 5_000 + index * 100, duration: 1_200 },
        segments: [{ steps: stepsByIndex[index] ?? [{}] }],
        extras: {
          waytype: {
            summary: [{ value: 6, distance: 4_000, amount: 80 }],
          },
        },
      },
    })),
  }
}

describe('buildAlternativeRoutesRequest', () => {
  it('builds a cycling directions request between two points requesting alternative routes', () => {
    const request = buildAlternativeRoutesRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    })

    expect(request.url).toBe(
      'https://api.openrouteservice.org/v2/directions/cycling-regular/geojson',
    )
    expect(request.body).toEqual({
      coordinates: [
        [13.405, 52.52],
        [13.42, 52.53],
      ],
      elevation: true,
      extra_info: ['waytype'],
      alternative_routes: {
        target_count: 3,
        share_factor: 0.6,
        weight_factor: 1.4,
      },
    })
  })

  it('targets an overridden ORS host when ORS_BASE_URL is set, so tests can point at a fixture server', () => {
    vi.stubEnv('ORS_BASE_URL', 'http://127.0.0.1:4319')

    const request = buildAlternativeRoutesRequest({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    })

    expect(request.url).toBe(
      'http://127.0.0.1:4319/v2/directions/cycling-regular/geojson',
    )

    vi.unstubAllEnvs()
  })

  it('builds a trekking directions request using the foot-walking profile', () => {
    const request = buildAlternativeRoutesRequest({
      activity: 'trekking',
      start: { lat: 48.2, lon: 16.37 },
      stop: { lat: 48.21, lon: 16.38 },
    })

    expect(request.url).toBe(
      'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
    )
  })
})

describe('fetchPointToPointRouteCandidates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('requests alternative routes from ORS between the two points in a single call', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(orsAlternativesResponse()),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPointToPointRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] ?? []
    const body = JSON.parse(init.body)
    expect(body.coordinates).toEqual([
      [13.405, 52.52],
      [13.42, 52.53],
    ])
    expect(body.alternative_routes.target_count).toBe(3)
  })

  it('scores each alternative using the same weighted-sum formula as loop candidates', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(orsAlternativesResponse({ count: 2 })),
      }),
    )

    const candidates = await fetchPointToPointRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    })

    expect(candidates).toHaveLength(2)
    const top = candidates[0]
    expect(top).toBeDefined()
    // fewest turn steps (2) wins over the other alternative (4 steps).
    expect(top?.metrics.turnCount).toBe(2)
    expect(top?.metrics.ascentMeters).toBe(10)
    expect(top?.metrics.pathTypeRatio).toBe(0.8)
    expect(top?.score).toBeCloseTo(10 * -0.05 + 2 * -0.5 + 0.8 * 50)
  })

  it('returns at most the top 3 alternatives, sorted best score first', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(orsAlternativesResponse({ count: 3 })),
      }),
    )

    const candidates = await fetchPointToPointRouteCandidates({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    })

    expect(candidates.length).toBeLessThanOrEqual(3)
    const scores = candidates.map((candidate) => candidate.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('throws when ORS response has no route features', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      }),
    )

    await expect(
      fetchPointToPointRouteCandidates({
        activity: 'cycling',
        start: { lat: 52.52, lon: 13.405 },
        stop: { lat: 52.53, lon: 13.42 },
      }),
    ).rejects.toThrow(/route feature/)
  })
})

describe('fetchLoopRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('calls ORS with the API key from the environment and maps the response to a route result', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleOrsResponse),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchLoopRoute({
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(
      'https://api.openrouteservice.org/v2/directions/cycling-regular/geojson',
    )
    expect(init.headers.Authorization).toBe('secret-key')
    expect(JSON.parse(init.body).options.round_trip.length).toBe(15_000)

    expect(result).toEqual({
      coordinates: [
        [52.52, 13.405],
        [52.525, 13.41],
        [52.52, 13.405],
      ],
      distanceMeters: 15_200,
      durationSeconds: 3_600,
    })
  })

  it('never leaks the API key into the returned route result', async () => {
    vi.stubEnv('ORS_API_KEY', 'super-secret')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleOrsResponse),
      }),
    )

    const result = await fetchLoopRoute({
      activity: 'trekking',
      start: { lat: 48.2, lon: 16.37 },
      durationMinutes: 60,
    })

    expect(JSON.stringify(result)).not.toContain('super-secret')
  })

  it('throws when the ORS API key is not configured', async () => {
    vi.stubEnv('ORS_API_KEY', '')

    await expect(
      fetchLoopRoute({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        durationMinutes: 60,
      }),
    ).rejects.toThrow(/ORS_API_KEY/)
  })

  it('throws when ORS responds with an error', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('bad request'),
      }),
    )

    await expect(
      fetchLoopRoute({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        durationMinutes: 60,
      }),
    ).rejects.toThrow(/ORS request failed/)
  })
})
