import { CandidateRow } from '#/components/CandidateRow'
import { MICRO_LABEL_CLASS, SELECT_CLASS } from '#/lib/controlStyles'
import { ELEVATION_METRIC_LABELS } from '#/lib/labels'
import { ROUTE_COLORS, type RankBy, type RankedCandidate } from '#/lib/ranking'
import type { RouteMode } from '#/lib/routeMode'
import type { ElevationMetricType } from '#/server/scoring'

const RANK_OPTIONS: { value: RankBy; label: string }[] = [
  { value: 'balanced', label: 'Best overall' },
  { value: 'flat', label: 'Flattest' },
  { value: 'gentle', label: 'Gentlest climbs' },
  { value: 'paths', label: 'Most bike path' },
  { value: 'turns', label: 'Fewest turns' },
]

function isRankBy(value: string): value is RankBy {
  return RANK_OPTIONS.some((option) => option.value === value)
}

function isElevationMetric(value: string): value is ElevationMetricType {
  return value === 'ascent' || value === 'netChange' || value === 'maxGradient'
}

/**
 * The three routes the search came back with, plus the two controls that
 * change how they read: what to optimise for, and which elevation signal to
 * judge climbs by (issue 003). Both re-sort the same three candidates on the
 * client — no refetch.
 */
export function ResultsPanel({
  mode,
  ranked,
  rankBy,
  onRankByChange,
  elevationMetric,
  onElevationMetricChange,
  selectedIndex,
  onSelect,
}: {
  mode: RouteMode
  ranked: RankedCandidate[]
  rankBy: RankBy
  onRankByChange: (rankBy: RankBy) => void
  elevationMetric: ElevationMetricType
  onElevationMetricChange: (elevationMetric: ElevationMetricType) => void
  /** originalIndex of the active route, if any. */
  selectedIndex: number | null
  onSelect: (originalIndex: number) => void
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-ink text-lg font-semibold">
        {mode === 'loop'
          ? `${ranked.length} loops from here`
          : `${ranked.length} routes to your stop`}
      </h2>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="rank-by" className={MICRO_LABEL_CLASS}>
            Rank by
          </label>
          <select
            id="rank-by"
            value={rankBy}
            onChange={(event) => {
              if (isRankBy(event.target.value)) {
                onRankByChange(event.target.value)
              }
            }}
            className={SELECT_CLASS}
          >
            {RANK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor="elevation-metric" className={MICRO_LABEL_CLASS}>
            Elevation metric
          </label>
          <select
            id="elevation-metric"
            value={elevationMetric}
            onChange={(event) => {
              if (isElevationMetric(event.target.value)) {
                onElevationMetricChange(event.target.value)
              }
            }}
            className={SELECT_CLASS}
          >
            {Object.entries(ELEVATION_METRIC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="space-y-2">
        {ranked.map((entry) => (
          <CandidateRow
            key={entry.originalIndex}
            ranked={entry}
            color={
              ROUTE_COLORS[entry.originalIndex % ROUTE_COLORS.length] ?? ''
            }
            elevationMetric={elevationMetric}
            isActive={entry.originalIndex === selectedIndex}
            onSelect={() => onSelect(entry.originalIndex)}
          />
        ))}
      </ul>
    </div>
  )
}
