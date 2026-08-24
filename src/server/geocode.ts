/**
 * Forward geocoding: resolves a free-text place name (e.g. "Berlin train
 * station") to a lat/lon, via ORS's Pelias-based `/geocode/search` endpoint.
 *
 * Used for point-to-point mode (issue 004) so the user can name a start/stop
 * location instead of only picking GPS/manual lat/lon. Kept deliberately
 * simple: one request per explicit "search" action, not live autocomplete.
 */

import { orsBaseUrl } from '#/server/orsConfig'

export type GeocodeRequest = { url: string }

/**
 * ASSUMPTION: ORS's geocode/search endpoint takes the API key as an
 * `api_key` query parameter (Pelias convention), unlike the directions
 * endpoint which uses an `Authorization` header. Not verified against a live
 * ORS response — revisit if geocoding calls fail with an auth error.
 */
export function buildGeocodeRequest(
  query: string,
  apiKey: string,
): GeocodeRequest {
  const url = new URL(`${orsBaseUrl()}/geocode/search`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('text', query)
  url.searchParams.set('size', '1')
  return { url: url.toString() }
}

export type GeocodeResult = {
  lat: number
  lon: number
  /** Human-readable display label for the resolved location, e.g. "Berlin, Germany". */
  label: string
}

function requireApiKey(): string {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    throw new Error('ORS_API_KEY is not configured on the server')
  }
  return apiKey
}

type GeocodeResponse = {
  features: {
    geometry: { coordinates: [number, number] }
    properties?: { label?: string }
  }[]
}

/**
 * Resolves a free-text place name to a lat/lon via ORS geocoding. This is the
 * serverless boundary — the ORS API key never reaches the client.
 */
export async function fetchGeocode(query: string): Promise<GeocodeResult> {
  const apiKey = requireApiKey()
  const request = buildGeocodeRequest(query, apiKey)

  const response = await fetch(request.url)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `ORS request failed with status ${response.status}: ${detail}`,
    )
  }

  const geojson: GeocodeResponse = await response.json()
  const feature = geojson.features[0]
  if (!feature) {
    throw new Error(`No location found for "${query}"`)
  }

  const [lon, lat] = feature.geometry.coordinates
  return {
    lat,
    lon,
    label: feature.properties?.label ?? query,
  }
}
