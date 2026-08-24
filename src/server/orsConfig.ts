/**
 * Where the OpenRouteService API lives, for the server-side code that calls it.
 *
 * Defaults to the real API, so production behaviour needs no configuration at
 * all. `ORS_BASE_URL` exists so a test run can point the app at a local
 * fixture server (see `e2e/fixtures/orsServer.ts`) and drive the whole journey
 * without a key, a network, or free-tier quota. Server-only, like the API key
 * itself — nothing here reaches the browser.
 */

const REAL_ORS_BASE_URL = 'https://api.openrouteservice.org'

/** Base URL for ORS requests, without a trailing slash. */
export function orsBaseUrl(): string {
  const override = process.env.ORS_BASE_URL
  if (!override) {
    return REAL_ORS_BASE_URL
  }
  return override.replace(/\/+$/, '')
}
