import { createServerFn } from '@tanstack/react-start'

import { fetchGeocode } from '#/server/geocode'

export type GeocodeLocationInput = { query: string }

export function validateGeocodeLocationInput(
  input: unknown,
): GeocodeLocationInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid geocode request')
  }

  const { query }: { query?: unknown } = input

  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Invalid query: must be a non-empty string')
  }

  return { query }
}

/**
 * Resolves a free-text place name to a lat/lon + display label (see
 * geocode.ts). This is the serverless boundary — the ORS API key never
 * reaches the client.
 */
export const geocodeLocation = createServerFn({ method: 'POST' })
  .validator(validateGeocodeLocationInput)
  .handler(async ({ data }) => fetchGeocode(data.query))
