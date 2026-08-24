import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_LABELS,
  elevationMetricDisplay,
  formatCoordinates,
  formatDurationLabel,
  formatRatio,
} from './labels'

describe('formatDurationLabel', () => {
  it('words a sub-hour duration in minutes', () => {
    expect(formatDurationLabel(30)).toBe('30 min')
  })

  it('drops the zero minutes on a whole hour', () => {
    expect(formatDurationLabel(60)).toBe('1 h')
  })

  it('words an hour and a half the way a person says it', () => {
    expect(formatDurationLabel(90)).toBe('1 h 30')
  })
})

describe('formatCoordinates', () => {
  it('shortens a lat/lon pair to three decimals', () => {
    expect(formatCoordinates({ lat: 52.5200066, lon: 13.404954 })).toBe(
      '52.520, 13.405',
    )
  })
})

describe('ACTIVITY_LABELS', () => {
  it('gives each activity a name and an icon', () => {
    expect(ACTIVITY_LABELS.cycling.name).toBe('Cycling')
    expect(ACTIVITY_LABELS.trekking.name).toBe('Trekking')
    expect(ACTIVITY_LABELS.cycling.icon).not.toBe(ACTIVITY_LABELS.trekking.icon)
  })
})

describe('formatRatio', () => {
  it('words a 0..1 share as whole percent', () => {
    expect(formatRatio(0.62)).toBe('62%')
  })
})

describe('elevationMetricDisplay', () => {
  const metrics = {
    ascentMeters: 123.4,
    netElevationChangeMeters: 30.6,
    maxGradientPercent: 8.53,
    turnCount: 8,
    pathTypeRatio: 0.5,
    constructionPenalty: 0,
  }

  it('shows total ascent in whole metres', () => {
    expect(elevationMetricDisplay('ascent', metrics)).toEqual({
      label: 'Total ascent',
      value: '123 m',
    })
  })

  it('shows net elevation change in whole metres', () => {
    expect(elevationMetricDisplay('netChange', metrics)).toEqual({
      label: 'Net elevation change',
      value: '31 m',
    })
  })

  it('shows max gradient as a percentage with one decimal', () => {
    expect(elevationMetricDisplay('maxGradient', metrics)).toEqual({
      label: 'Max gradient',
      value: '8.5%',
    })
  })

  it('falls back to zero when the optional elevation signal is missing', () => {
    expect(
      elevationMetricDisplay('maxGradient', {
        ascentMeters: 10,
        turnCount: 1,
        pathTypeRatio: 0,
        constructionPenalty: 0,
      }).value,
    ).toBe('0.0%')
  })
})
