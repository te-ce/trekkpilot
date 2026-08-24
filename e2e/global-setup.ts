/**
 * Brings up the fixture OpenRouteService server for the whole e2e run, and
 * tears it down afterwards. The app is pointed at it by `ORS_BASE_URL` in
 * `playwright.config.ts`, so no real key, network access or free-tier quota is
 * involved in an e2e run.
 */

import { startOrsFixtureServer } from './fixtures/orsServer'

export default async function globalSetup() {
  const server = await startOrsFixtureServer()

  return async () => {
    await server.close()
  }
}
