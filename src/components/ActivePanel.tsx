import { buildGoogleMapsUrl } from '#/lib/googleMaps'
import {
  METRICS_LINE_CLASS,
  PRIMARY_BUTTON_CLASS,
  QUIET_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '#/lib/controlStyles'
import { downloadGpx } from '#/lib/gpx'
import { elevationMetricDisplay, formatRatio } from '#/lib/labels'
import { formatDistance, formatDuration } from '#/lib/ranking'
import type { RouteMode } from '#/lib/routeMode'
import type { LoopRouteCandidate } from '#/server/ors'
import type { ElevationMetricType } from '#/server/scoring'

export type ActiveRoute = {
  /** What this route is, in the sheet header: "Route #2", "Saved 2026-08-24 14:05". */
  title: string
  candidate: LoopRouteCandidate
  /** Literal hex of this route's line, so the header matches the map. */
  color: string
  /** 1-based number used in the exported GPX filename. */
  exportIndex: number
}

const CAVEAT_CLASS = 'mt-1 text-xs text-ink-3'

/**
 * The route the user settled on: the numbers again, the action that starts the
 * ride, and the two ways out of the app. Each export carries its own caveat,
 * right under the control it applies to — a shared paragraph makes the reader
 * work out which half is about which button.
 */
export function ActivePanel({
  route,
  mode,
  elevationMetric,
  onStart,
  onBack,
}: {
  route: ActiveRoute
  mode: RouteMode
  elevationMetric: ElevationMetricType
  onStart: () => void
  /** Back to the list of options; omitted when there is no list to go back to. */
  onBack: (() => void) | null
}) {
  const { candidate } = route
  const elevation = elevationMetricDisplay(elevationMetric, candidate.metrics)

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`-ml-1 ${QUIET_BUTTON_CLASS}`}
        >
          ← All routes
        </button>
      )}

      <div>
        <h2 className="text-ink flex items-center gap-2 text-lg font-semibold">
          <span
            aria-hidden="true"
            style={{ backgroundColor: route.color }}
            className="size-3 shrink-0 rounded-full"
          />
          {route.title}
        </h2>
        <p className="text-ink mt-1 font-mono text-2xl font-medium tabular-nums">
          {formatDistance(candidate.distanceMeters)}
          <span className="text-ink-2 ml-2 text-base">
            {formatDuration(candidate.durationSeconds)}
          </span>
        </p>
        <p className={`mt-1 ${METRICS_LINE_CLASS}`}>
          {elevation.label} {elevation.value} · {candidate.metrics.turnCount}{' '}
          turns · {formatRatio(candidate.metrics.pathTypeRatio)} paths ·{' '}
          {formatRatio(candidate.metrics.constructionPenalty)} roadworks
        </p>
      </div>

      <button type="button" onClick={onStart} className={PRIMARY_BUTTON_CLASS}>
        {mode === 'loop' ? 'Start this loop' : 'Start this route'}
      </button>

      <div>
        <button
          type="button"
          onClick={() =>
            downloadGpx(
              { coordinates: candidate.coordinates },
              `trekkpilot-route-${route.exportIndex}.gpx`,
            )
          }
          className={`w-full ${SECONDARY_BUTTON_CLASS}`}
        >
          Download GPX
        </button>
        <p className={CAVEAT_CLASS}>
          Exact geometry: the file follows this line point for point.
        </p>
      </div>

      <div>
        <a
          href={buildGoogleMapsUrl(candidate.coordinates)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full items-center justify-center ${SECONDARY_BUTTON_CLASS}`}
        >
          Open in Google Maps
        </a>
        <p className={CAVEAT_CLASS} data-testid="google-maps-caveat">
          Approximate: Google navigates through up to 9 waypoints of this route
          and recalculates the rest, so expect it to deviate.
        </p>
      </div>
    </div>
  )
}
