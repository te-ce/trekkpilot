import { defineConfig } from '@playwright/test'

import {
  ORS_FIXTURE_API_KEY,
  ORS_FIXTURE_BASE_URL,
} from './e2e/fixtures/orsServer'

// Drives the real app in a browser against the Vite preview server.
// Requires `pnpm build` first.
//
// OpenRouteService is stood in for by a local fixture server (started in
// `e2e/global-setup.ts`), which the app reaches because `ORS_BASE_URL` points
// at it. So the suite drives the whole journey — search, ranking, export,
// history — with no real key, no network and no quota spent.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'pnpm preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    env: {
      ORS_BASE_URL: ORS_FIXTURE_BASE_URL,
      ORS_API_KEY: ORS_FIXTURE_API_KEY,
    },
  },
  use: {
    baseURL: 'http://localhost:4173',
  },
})
