import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGeocodeRequest, fetchGeocode } from './geocode'

const sampleGeocodeResponse = {
  features: [
    {
      geometry: { coordinates: [13.405, 52.52] },
      properties: { label: 'Berlin, Germany' },
    },
  ],
}

describe('buildGeocodeRequest', () => {
  it('builds a GET request URL against ORS geocode/search with the query text and API key', () => {
    const request = buildGeocodeRequest('Berlin', 'secret-key')

    const url = new URL(request.url)
    expect(url.origin + url.pathname).toBe(
      'https://api.openrouteservice.org/geocode/search',
    )
    expect(url.searchParams.get('api_key')).toBe('secret-key')
    expect(url.searchParams.get('text')).toBe('Berlin')
  })
})

describe('fetchGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('resolves a place name to a lat/lon and display label', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleGeocodeResponse),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchGeocode('Berlin')

    expect(result).toEqual({
      lat: 52.52,
      lon: 13.405,
      label: 'Berlin, Germany',
    })
  })

  it('throws when the ORS API key is not configured', async () => {
    vi.stubEnv('ORS_API_KEY', '')

    await expect(fetchGeocode('Berlin')).rejects.toThrow(/ORS_API_KEY/)
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

    await expect(fetchGeocode('Berlin')).rejects.toThrow(/ORS request failed/)
  })

  it('throws a helpful error when no location matches the query', async () => {
    vi.stubEnv('ORS_API_KEY', 'secret-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      }),
    )

    await expect(fetchGeocode('Nowhereville')).rejects.toThrow(
      /No location found/,
    )
  })
})
