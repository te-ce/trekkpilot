import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  parseDurationMinutes,
} from './duration'

describe('parseDurationMinutes', () => {
  it('accepts the duration the plan opens with', () => {
    expect(parseDurationMinutes(String(DEFAULT_DURATION_MINUTES))).toEqual({
      minutes: 60,
    })
  })

  it('accepts an arbitrary number no preset ever offered', () => {
    expect(parseDurationMinutes('47')).toEqual({ minutes: 47 })
  })

  it('keeps a fractional number as typed, without snapping it', () => {
    expect(parseDurationMinutes('62.5')).toEqual({ minutes: 62.5 })
  })

  it('ignores surrounding whitespace', () => {
    expect(parseDurationMinutes('  90  ')).toEqual({ minutes: 90 })
  })

  it('asks for a number when the field is empty', () => {
    expect(parseDurationMinutes('')).toEqual({
      error: 'Enter how many minutes you want to be out — 60, for example.',
    })
  })

  it('asks for a number when the text is not one', () => {
    expect(parseDurationMinutes('an hour')).toEqual({
      error: 'Enter how many minutes you want to be out — 60, for example.',
    })
  })

  it('rejects zero minutes, which is no route at all', () => {
    expect(parseDurationMinutes('0')).toEqual({
      error: 'Enter more than 0 minutes — 60, for example.',
    })
  })

  it('rejects a negative number of minutes', () => {
    expect(parseDurationMinutes('-30')).toEqual({
      error: 'Enter more than 0 minutes — 60, for example.',
    })
  })

  it('rejects a duration nobody could ride or walk in one go', () => {
    expect(parseDurationMinutes(String(MAX_DURATION_MINUTES + 1))).toEqual({
      error: `That is longer than one outing. Enter ${String(MAX_DURATION_MINUTES)} minutes (8 h) or less.`,
    })
  })

  it('accepts the longest duration on offer', () => {
    expect(parseDurationMinutes(String(MAX_DURATION_MINUTES))).toEqual({
      minutes: 480,
    })
  })
})
