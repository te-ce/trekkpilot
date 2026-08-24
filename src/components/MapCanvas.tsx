import { ClientOnly } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import type { RouteMapProps } from '#/components/RouteMap'

/**
 * Leaflet reads `window` while it is being imported, so `RouteMap` must not be
 * part of the server bundle at all — a static import of it 500s the page
 * before React ever renders. Hence a dynamic import behind `ClientOnly`: the
 * server (and the first hydration pass) paints the map's ground colour, and
 * the real map arrives once we are in a browser.
 */
const RouteMap = lazy(async () => ({
  default: (await import('#/components/RouteMap')).RouteMap,
}))

/** Placeholder that holds the map's space without pretending to be a map. */
function mapGround() {
  return <div className="bg-ground h-full w-full" />
}

export function MapCanvas(props: RouteMapProps) {
  return (
    <ClientOnly fallback={mapGround()}>
      <Suspense fallback={mapGround()}>
        <RouteMap {...props} />
      </Suspense>
    </ClientOnly>
  )
}
