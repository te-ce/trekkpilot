import { type GeoPoint } from '#/components/LocationPicker'
import { RouteMap } from '#/components/RouteMap'
import { buildGoogleMapsUrl } from '#/lib/googleMaps'
import { downloadGpx } from '#/lib/gpx'
import type { LoopRouteCandidate } from '#/server/ors'

export type ActiveRoute = {
  label: string
  start: GeoPoint
  candidate: LoopRouteCandidate
  /** 1-based index used for the exported GPX filename; falls back to 1 for history entries. */
  exportIndex: number
}

function toTuple(point: GeoPoint): [number, number] {
  return [point.lat, point.lon]
}

/** Builds the optional `livePosition` prop for RouteMap, respecting exactOptionalPropertyTypes. */
function livePositionProp(
  livePosition: GeoPoint | null,
): { livePosition: [number, number] } | Record<string, never> {
  return livePosition ? { livePosition: toTuple(livePosition) } : {}
}

export function ActiveRouteSection({
  activeRoute,
  livePosition,
}: {
  activeRoute: ActiveRoute | null
  livePosition: GeoPoint | null
}) {
  if (!activeRoute) {
    return null
  }

  return (
    <section aria-label="Active route" data-testid="active-route">
      <h2>Active route: {activeRoute.label}</h2>
      <RouteMap
        start={[activeRoute.start.lat, activeRoute.start.lon]}
        coordinates={activeRoute.candidate.coordinates}
        {...livePositionProp(livePosition)}
      />
      <p>
        <strong>Exact route (GPX):</strong> reproduces the scored route exactly.{' '}
        <strong>Approximate (Google Maps):</strong> Google Maps recalculates
        directions through these points, so it may deviate from the scored
        route.
      </p>
      <button
        type="button"
        onClick={() =>
          downloadGpx(
            { coordinates: activeRoute.candidate.coordinates },
            `trekkpilot-candidate-${activeRoute.exportIndex}.gpx`,
          )
        }
      >
        Export GPX
      </button>
      <a
        href={buildGoogleMapsUrl(activeRoute.candidate.coordinates)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in Google Maps
      </a>
    </section>
  )
}
