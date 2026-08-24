/**
 * What the sheet shows while a search is in flight. The search is five
 * separate routing calls, so the copy says so rather than spinning silently:
 * a few seconds of waiting is much easier to accept when you know why.
 */
export function LoadingPanel() {
  return (
    <div className="space-y-3">
      <h2 className="text-ink text-lg font-semibold">Finding routes…</h2>
      <p className="text-ink-2 text-sm">
        Comparing 5 route options from the routing service, then keeping the
        best 3. This usually takes a few seconds.
      </p>
      <ul className="space-y-2">
        {[0, 1, 2].map((row) => (
          <li
            key={row}
            data-testid="skeleton-row"
            className="border-line bg-surface-2 animate-pulse rounded-2xl border p-3"
          >
            <div className="bg-line h-5 w-24 rounded" />
            <div className="bg-line mt-2 h-3 w-40 rounded" />
          </li>
        ))}
      </ul>
    </div>
  )
}
