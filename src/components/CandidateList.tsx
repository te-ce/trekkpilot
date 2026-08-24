import { type GeoPoint } from '#/components/LocationPicker'
import { RouteMap } from '#/components/RouteMap'
import type { LoopRouteCandidate } from '#/server/ors'
import type { CandidateMetrics, ElevationMetricType } from '#/server/scoring'

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Label + formatted value for the currently-selected elevation metric, for candidate display. */
function elevationMetricDisplay(
  elevationMetric: ElevationMetricType,
  metrics: CandidateMetrics,
): { label: string; value: string } {
  switch (elevationMetric) {
    case 'netChange':
      return {
        label: 'Net elevation change',
        value: `${Math.round(metrics.netElevationChangeMeters ?? 0)} m`,
      }
    case 'maxGradient':
      return {
        label: 'Max gradient',
        value: `${(metrics.maxGradientPercent ?? 0).toFixed(1)}%`,
      }
    case 'ascent':
      return {
        label: 'Ascent',
        value: `${Math.round(metrics.ascentMeters)} m`,
      }
  }
}

export function CandidateList({
  candidates,
  start,
  elevationMetric,
  onSelect,
}: {
  candidates: LoopRouteCandidate[]
  start: GeoPoint | null
  elevationMetric: ElevationMetricType
  onSelect: (index: number) => void
}) {
  if (candidates.length === 0 || !start) {
    return null
  }

  return (
    <section aria-label="Route candidates">
      <h2>Top {candidates.length} route candidates</h2>
      <ul>
        {candidates.map((candidate, index) => (
          <li key={index}>
            <h3>Candidate {index + 1}</h3>
            <div className="h-[400px] w-full">
              <RouteMap
                start={[start.lat, start.lon]}
                routes={[
                  {
                    id: `candidate-${index}`,
                    coordinates: candidate.coordinates,
                    color: '#0B6E4F',
                    isActive: true,
                  },
                ]}
              />
            </div>
            <dl>
              <dt>Score</dt>
              <dd>{candidate.score.toFixed(1)}</dd>
              <dt>
                {
                  elevationMetricDisplay(elevationMetric, candidate.metrics)
                    .label
                }
              </dt>
              <dd>
                {
                  elevationMetricDisplay(elevationMetric, candidate.metrics)
                    .value
                }
              </dd>
              <dt>Turns</dt>
              <dd>{candidate.metrics.turnCount}</dd>
              <dt>Dedicated cycleway/footway</dt>
              <dd>{formatRatio(candidate.metrics.pathTypeRatio)}</dd>
              <dt>Construction penalty</dt>
              <dd>{formatRatio(candidate.metrics.constructionPenalty)}</dd>
            </dl>
            <button type="button" onClick={() => onSelect(index)}>
              Use this route
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
