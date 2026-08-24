import { METRICS_LINE_CLASS } from '#/lib/controlStyles'
import { elevationMetricDisplay, formatRatio } from '#/lib/labels'
import {
  formatDistance,
  formatDuration,
  type RankedCandidate,
} from '#/lib/ranking'
import type { ElevationMetricType } from '#/server/scoring'

/**
 * One route in the list. Distance and time lead, because that is what a person
 * decides on; the swatch ties the row to its line on the map, and the metrics
 * line carries the detail for whoever wants it.
 */
export function CandidateRow({
  ranked,
  color,
  elevationMetric,
  isActive,
  onSelect,
}: {
  ranked: RankedCandidate
  /** Literal hex of this route's polyline, so row and line match. */
  color: string
  elevationMetric: ElevationMetricType
  isActive: boolean
  onSelect: () => void
}) {
  const { candidate, rank, reason } = ranked
  const elevation = elevationMetricDisplay(elevationMetric, candidate.metrics)

  return (
    <li>
      <button
        type="button"
        data-testid="candidate-row"
        aria-current={isActive ? 'true' : undefined}
        onClick={onSelect}
        className={`focus-visible:outline-moss w-full rounded-2xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 ${
          isActive
            ? 'border-moss bg-surface-2'
            : 'border-line bg-surface hover:bg-surface-2'
        }`}
      >
        <span className="flex items-baseline gap-2">
          <span
            data-testid="route-swatch"
            aria-hidden="true"
            style={{ backgroundColor: color }}
            className="size-3 shrink-0 rounded-full"
          />
          <span className="text-ink font-mono text-lg font-medium tabular-nums">
            {formatDistance(candidate.distanceMeters)}
          </span>
          <span className="text-ink-2 font-mono text-sm tabular-nums">
            {formatDuration(candidate.durationSeconds)}
          </span>
          <span className="text-ink-3 ml-auto font-mono text-xs tabular-nums">
            #{rank}
          </span>
        </span>

        <span className="bg-surface-2 text-ink-2 mt-2 inline-flex rounded-full px-2 py-0.5 text-xs">
          {reason}
        </span>

        <span className={`mt-2 block ${METRICS_LINE_CLASS}`}>
          {elevation.label} {elevation.value} · {candidate.metrics.turnCount}{' '}
          turns · {formatRatio(candidate.metrics.pathTypeRatio)} paths ·{' '}
          {formatRatio(candidate.metrics.constructionPenalty)} roadworks
        </span>
      </button>
    </li>
  )
}
