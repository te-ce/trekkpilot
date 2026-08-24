import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('#/components/RouteMap', () => ({
  RouteMap: (props: { routes: { id: string }[] }) => (
    <div data-testid="route-map" data-routes={JSON.stringify(props.routes)} />
  ),
}))

import { MapCanvas } from './MapCanvas'

describe('MapCanvas', () => {
  it('mounts the map on the client and passes the props straight through', async () => {
    render(
      <MapCanvas
        start={[52.52, 13.405]}
        routes={[{ id: 'a', coordinates: [], color: '#000', isActive: true }]}
      />,
    )

    const map = await screen.findByTestId('route-map')
    expect(map.getAttribute('data-routes')).toContain('"id":"a"')
  })

  it('never imports Leaflet at module scope, which would break server rendering', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/MapCanvas.tsx'),
      'utf8',
    )

    // Leaflet touches `window` while it is being imported, so the only
    // reference to RouteMap here may be a lazy (dynamic) one plus a type-only
    // import. A plain `import { RouteMap } from ...` would 500 the page.
    expect(source).not.toMatch(/^import \{ RouteMap \}/m)
    expect(source).toMatch(/import\(['"]#\/components\/RouteMap['"]\)/)
  })
})
