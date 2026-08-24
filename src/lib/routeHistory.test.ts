import { beforeEach, describe, expect, it } from 'vitest'

import { getRouteHistory, saveRouteToHistory } from './routeHistory'

const sampleCandidate = {
  coordinates: [
    [52.52, 13.405],
    [52.525, 13.41],
    [52.52, 13.405],
  ] as [number, number][],
  distanceMeters: 15_000,
  durationSeconds: 3_600,
  metrics: {
    ascentMeters: 120,
    turnCount: 8,
    pathTypeRatio: 0.6,
    constructionPenalty: 0,
  },
  score: 24,
}

describe('getRouteHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty array when nothing has been saved yet', () => {
    expect(getRouteHistory()).toEqual([])
  })

  it('returns an empty array when the stored value is corrupt JSON', () => {
    localStorage.setItem('trekkpilot-route-history', '{not valid json')
    expect(getRouteHistory()).toEqual([])
  })
})

describe('saveRouteToHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists a route so it shows up in getRouteHistory', () => {
    saveRouteToHistory({
      activity: 'cycling',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidate,
    })

    const history = getRouteHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      activity: 'cycling',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidate,
      score: 24,
    })
    expect(history[0]?.id).toEqual(expect.any(String))
    expect(history[0]?.timestamp).toEqual(expect.any(Number))
  })

  it('records which kind of route was saved, so a point-to-point duration is never shown as a plan', () => {
    saveRouteToHistory({
      activity: 'trekking',
      mode: 'pointToPoint',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidate,
    })

    expect(getRouteHistory()[0]?.mode).toBe('pointToPoint')
  })

  it('treats an entry saved before modes were recorded as a loop', () => {
    saveRouteToHistory({
      activity: 'cycling',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidate,
    })

    expect(getRouteHistory()[0]?.mode).toBe('loop')
  })

  it('keeps only the most recent 30 entries once the cap is exceeded', () => {
    for (let i = 0; i < 35; i++) {
      saveRouteToHistory({
        activity: 'cycling',
        durationMinutes: i,
        start: { lat: 52.52, lon: 13.405 },
        candidate: sampleCandidate,
      })
    }

    const history = getRouteHistory()
    expect(history).toHaveLength(30)
    // Oldest entries (durationMinutes 0-4) should have been dropped, keeping
    // the most recent ones (durationMinutes 5-34).
    expect(history[0]?.durationMinutes).toBe(5)
    expect(history[history.length - 1]?.durationMinutes).toBe(34)
  })
})
