import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildRoundTripRequest, fetchLoopRoute } from './ors'

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
      options: {
        round_trip: {
          length: 15_000,
          points: 3,
        },
      },
    })
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
      vi
        .fn()
        .mockResolvedValue({
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
      vi
        .fn()
        .mockResolvedValue({
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
