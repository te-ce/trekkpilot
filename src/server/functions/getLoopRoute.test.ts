import { describe, expect, it } from 'vitest'

import { validateLoopRouteInput } from './getLoopRoute'

describe('validateLoopRouteInput', () => {
  it('accepts a well-formed cycling request', () => {
    const input = {
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    }
    expect(validateLoopRouteInput(input)).toEqual({
      ...input,
      elevationMetric: 'ascent',
    })
  })

  it('rejects an unknown activity type', () => {
    expect(() =>
      validateLoopRouteInput({
        activity: 'flying',
        start: { lat: 0, lon: 0 },
        durationMinutes: 60,
      }),
    ).toThrow(/activity/)
  })

  it('rejects a non-positive duration', () => {
    expect(() =>
      validateLoopRouteInput({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        durationMinutes: 0,
      }),
    ).toThrow(/duration/)
  })

  it('rejects a missing start point', () => {
    expect(() =>
      validateLoopRouteInput({ activity: 'cycling', durationMinutes: 60 }),
    ).toThrow(/start/)
  })

  it('defaults elevationMetric to "ascent" when not provided', () => {
    const input = {
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    }
    expect(validateLoopRouteInput(input).elevationMetric).toBe('ascent')
  })

  it('accepts an explicit elevationMetric of netChange or maxGradient', () => {
    const base = {
      activity: 'cycling',
      start: { lat: 52.52, lon: 13.405 },
      durationMinutes: 60,
    }
    expect(
      validateLoopRouteInput({ ...base, elevationMetric: 'netChange' })
        .elevationMetric,
    ).toBe('netChange')
    expect(
      validateLoopRouteInput({ ...base, elevationMetric: 'maxGradient' })
        .elevationMetric,
    ).toBe('maxGradient')
  })

  it('rejects an unknown elevationMetric', () => {
    expect(() =>
      validateLoopRouteInput({
        activity: 'cycling',
        start: { lat: 0, lon: 0 },
        durationMinutes: 60,
        elevationMetric: 'steepness',
      }),
    ).toThrow(/elevationMetric/)
  })
})
