import { afterEach, describe, expect, it, vi } from 'vitest'

import { orsBaseUrl } from './orsConfig'

describe('orsBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('points at the real OpenRouteService API by default', () => {
    expect(orsBaseUrl()).toBe('https://api.openrouteservice.org')
  })

  it('points at an override host when ORS_BASE_URL is set', () => {
    vi.stubEnv('ORS_BASE_URL', 'http://127.0.0.1:4319')

    expect(orsBaseUrl()).toBe('http://127.0.0.1:4319')
  })

  it('ignores an empty override, so a blank variable cannot break routing', () => {
    vi.stubEnv('ORS_BASE_URL', '')

    expect(orsBaseUrl()).toBe('https://api.openrouteservice.org')
  })
})
