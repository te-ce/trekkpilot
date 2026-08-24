import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: ['src/routes/**/*.{ts,tsx}', 'src/router.tsx', 'e2e/**/*.spec.ts'],
  project: ['src/**/*.{ts,tsx,css}', '!src/routeTree.gen.ts', 'e2e/**/*.ts'],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ['@testing-library/user-event', 'fast-check'],
}

export default config
