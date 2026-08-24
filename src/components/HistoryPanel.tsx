import { METRICS_LINE_CLASS, QUIET_BUTTON_CLASS } from '#/lib/controlStyles'
import { ACTIVITY_LABELS, formatDurationLabel } from '#/lib/labels'
import { formatDistance } from '#/lib/ranking'
import { formatHistoryDate, type HistoryEntry } from '#/lib/routeHistory'

/**
 * Routes saved on this device (issue 008). Each row leads with the distance —
 * the thing that tells you which ride this was — and only shows a planned
 * duration for loops: on a point-to-point route that number was never the
 * user's ask, so printing it would be inventing a fact.
 */
export function HistoryPanel({
  entries,
  onView,
  onBack,
}: {
  entries: HistoryEntry[]
  onView: (entry: HistoryEntry) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className={`-ml-1 ${QUIET_BUTTON_CLASS}`}
      >
        ← Back
      </button>
      <h2 className="text-ink text-lg font-semibold">Saved routes</h2>

      {entries.length === 0 ? (
        <p className="text-ink-2 text-sm">
          No saved routes yet. Pick a route and it lands here.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                data-testid="history-entry"
                onClick={() => onView(entry)}
                className="border-line bg-surface hover:bg-surface-2 focus-visible:outline-moss w-full rounded-2xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-ink font-mono text-lg font-medium tabular-nums">
                    {formatDistance(entry.candidate.distanceMeters)}
                  </span>
                  <span className="text-ink-2 text-sm">
                    {ACTIVITY_LABELS[entry.activity].name}
                  </span>
                  <span className="text-ink-3 ml-auto text-xs">
                    {entry.mode === 'loop' ? 'Loop' : 'A→B'}
                  </span>
                </span>
                <span className={`mt-1 block ${METRICS_LINE_CLASS}`}>
                  {entry.mode === 'loop' &&
                    `planned ${formatDurationLabel(entry.durationMinutes)} · `}
                  {formatHistoryDate(entry.timestamp)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
