import { describe, expect, it } from 'vitest'

import { validateGeocodeLocationInput } from './geocodeLocation'

describe('validateGeocodeLocationInput', () => {
  it('accepts a well-formed query string', () => {
    expect(validateGeocodeLocationInput({ query: 'Berlin' })).toEqual({
      query: 'Berlin',
    })
  })

  it('rejects a missing query', () => {
    expect(() => validateGeocodeLocationInput({})).toThrow(/query/)
  })

  it('rejects an empty/blank query', () => {
    expect(() => validateGeocodeLocationInput({ query: '   ' })).toThrow(
      /query/,
    )
  })

  it('rejects a non-string query', () => {
    expect(() => validateGeocodeLocationInput({ query: 42 })).toThrow(/query/)
  })
})
