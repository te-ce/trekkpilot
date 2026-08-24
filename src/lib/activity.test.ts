import { describe, expect, it } from 'vitest'

import { targetDistanceMeters } from './activity'

describe('targetDistanceMeters', () => {
  it('converts a 60 minute cycling duration to 15km using the default cycling speed', () => {
    expect(targetDistanceMeters('cycling', 60)).toBe(15_000)
  })

  it('converts a 60 minute trekking duration to 4.5km using the default trekking speed', () => {
    expect(targetDistanceMeters('trekking', 60)).toBe(4_500)
  })

  it('scales linearly with duration', () => {
    expect(targetDistanceMeters('cycling', 30)).toBe(7_500)
  })
})
