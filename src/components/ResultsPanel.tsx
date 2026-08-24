import { CandidateRow } from '#/components/CandidateRow'
import {
  MICRO_LABEL_CLASS,
  SECONDARY_BUTTON_CLASS,
  SELECT_CLASS,
} from '#/lib/controlStyles'
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
 * The routes the search came back with so far (a "load more" button reveals
 * the rest of the fetched pool), plus the two controls that change how they
 * read: what to optimise for, and which elevation signal to judge climbs by
 * (issue 003). Both re-sort the same visible candidates on the client — no
 * refetch.
 */
export function ResultsPanel({
  mode,
  ranked,
  totalCount,
  onLoadMore,
  rankBy,
  onRankByChange,
  elevationMetric,
  onElevationMetricChange,
  selectedIndex,
  onSelect,
}: {
  mode: RouteMode
  /** Currently-visible candidates, already sliced to the revealed count. */
  ranked: RankedCandidate[]
  /** Size of the full fetched pool, including candidates not yet revealed. */
  totalCount: number
  onLoadMore: () => void
  rankBy: RankBy
  onRankByChange: (rankBy: RankBy) => void
  elevationMetric: ElevationMetricType
  onElevationMetricChange: (elevationMetric: ElevationMetricType) => void
  /** originalIndex of the active route, if any. */
  selectedIndex: number | null
  onSelect: (originalIndex: number) => void
}) {
  const hasMore = ranked.length < totalCount
  const noun = mode === 'loop' ? 'loops from here' : 'routes to your stop'

  return (
    <div className="space-y-3">
      <h2 className="text-ink text-lg font-semibold">
        {hasMore
          ? `Showing ${ranked.length} of ${totalCount} ${noun}`
          : `${ranked.length} ${noun}`}
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

      {hasMore && (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={onLoadMore}
        >
          Load more routes
        </button>
      )}
    </div>
  )
}
