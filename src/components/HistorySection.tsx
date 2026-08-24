import { formatHistoryDate, type HistoryEntry } from '#/lib/routeHistory'

export function HistorySection({
  isOpen,
  entries,
  onView,
}: {
  isOpen: boolean
  entries: HistoryEntry[]
  onView: (entry: HistoryEntry) => void
}) {
  if (!isOpen) {
    return null
  }

  return (
    <section aria-label="Route history">
      <h2>Route history</h2>
      {entries.length === 0 ? (
        <p>No saved routes yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <dl>
                <dt>Activity</dt>
                <dd>{entry.activity}</dd>
                <dt>Duration (minutes)</dt>
                <dd>{entry.durationMinutes}</dd>
                <dt>Saved</dt>
                <dd>{formatHistoryDate(entry.timestamp)}</dd>
                <dt>Score</dt>
                <dd>{entry.score.toFixed(1)}</dd>
              </dl>
              <button type="button" onClick={() => onView(entry)}>
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
