import { describe, expect, it } from 'vitest'

import { buildGoogleMapsUrl } from './googleMaps'

describe('buildGoogleMapsUrl', () => {
  it('builds an origin/destination deep link with no waypoints for a 2-point route', () => {
    const url = buildGoogleMapsUrl([
      [52.52, 13.405],
      [52.53, 13.42],
    ])

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=52.52,13.405&destination=52.53,13.42',
    )
  })

  it('includes all intermediate points as pipe-separated waypoints when the route has 9 or fewer points', () => {
    const url = buildGoogleMapsUrl([
      [52.52, 13.405],
      [52.521, 13.406],
      [52.522, 13.407],
      [52.53, 13.42],
    ])

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=52.52,13.405&destination=52.53,13.42&waypoints=52.521,13.406|52.522,13.407',
    )
  })

  it('down-samples a route with more than 9 points to 9 evenly-spaced points, always including the first and last', () => {
    // 20 points, indexed by latitude (0..19), so we can assert exactly which
    // indices survive down-sampling.
    const coordinates: [number, number][] = Array.from(
      { length: 20 },
      (_, i) => [i, 0],
    )

    const url = buildGoogleMapsUrl(coordinates)

    // Evenly spaced across 9 slots (index i -> round(i * 19 / 8)):
    // 0, 2, 5, 7, 10, 12, 14, 17, 19
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=0,0&destination=19,0' +
        '&waypoints=2,0|5,0|7,0|10,0|12,0|14,0|17,0',
    )
  })

  it('uses all 9 points as-is when the route has exactly 9 points', () => {
    const coordinates: [number, number][] = Array.from(
      { length: 9 },
      (_, i) => [i, 0],
    )

    const url = buildGoogleMapsUrl(coordinates)

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=0,0&destination=8,0' +
        '&waypoints=1,0|2,0|3,0|4,0|5,0|6,0|7,0',
    )
  })

  it('uses the single point as both origin and destination for a single-point route', () => {
    const url = buildGoogleMapsUrl([[52.52, 13.405]])

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=52.52,13.405&destination=52.52,13.405',
    )
  })
})
