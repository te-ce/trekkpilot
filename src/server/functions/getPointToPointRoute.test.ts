import { describe, expect, it } from 'vitest'

import { validatePointToPointRouteInput } from './getPointToPointRoute'

describe('validatePointToPointRouteInput', () => {
  it('accepts a well-formed cycling request', () => {
    const input = {
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      stop: { lat: 52.53, lon: 13.42 },
    }
    expect(validatePointToPointRouteInput(input)).toEqual({
      ...input,
      elevationMetric: 'ascent',
    })
  })

  it('rejects an unknown activity type', () => {
    expect(() =>
      validatePointToPointRouteInput({
        activity: 'flying',
        start: { lat: 0, lon: 0 },
        stop: { lat: 1, lon: 1 },
      }),
    ).toThrow(/activity/)
  })

  it('rejects a missing start point', () => {
    expect(() =>
      validatePointToPointRouteInput({
        activity: 'cycling',
        stop: { lat: 1, lon: 1 },
      }),
    ).toThrow(/start/)
  })

  it('rejects a missing stop point', () => {
    expect(() =>
      validatePointToPointRouteInput({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
      }),
    ).toThrow(/stop/)
  })

  it('accepts an explicit elevationMetric', () => {
    expect(
      validatePointToPointRouteInput({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        stop: { lat: 1, lon: 1 },
        elevationMetric: 'maxGradient',
      }).elevationMetric,
    ).toBe('maxGradient')
  })

  it('rejects an unknown elevationMetric', () => {
    expect(() =>
      validatePointToPointRouteInput({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        stop: { lat: 1, lon: 1 },
        elevationMetric: 'steepness',
      }),
    ).toThrow(/elevationMetric/)
  })
})
