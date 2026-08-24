import type { GeoPoint } from '#/components/LocationPicker'
import type { ActivityType } from '#/lib/activity'
import { ICON_BUTTON_CLASS, PILL_CLASS } from '#/lib/controlStyles'
import {
  ACTIVITY_LABELS,
  formatCoordinates,
  formatDurationLabel,
} from '#/lib/labels'
import type { RouteMode } from '#/lib/routeMode'

/**
 * The floating bar over the map: what was asked for, where it starts, and the
 * two controls that belong to the map rather than the sheet (follow and
 * history). Safe-area aware, because on a phone this sits under the notch.
 */
export function TopPillBar({
  mode,
  activity,
  durationMinutes,
  start,
  startLabel,
  follow,
  onToggleFollow,
  onEditPlan,
  onEditStart,
  onOpenHistory,
}: {
  mode: RouteMode
  activity: ActivityType
  durationMinutes: number
  start: GeoPoint | null
  startLabel: string | null
  follow: boolean
  onToggleFollow: () => void
  onEditPlan: () => void
  onEditStart: () => void
  onOpenHistory: () => void
}) {
  const { icon, name } = ACTIVITY_LABELS[activity]
  const planSummary =
    mode === 'loop' ? formatDurationLabel(durationMinutes) : 'A→B'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="sr-only">TrekkPilot — routes from where you are</h1>

      <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap gap-2">
        <button type="button" onClick={onEditPlan} className={PILL_CLASS}>
          <span aria-hidden="true">{icon}</span>
          <span className="truncate">
            {name} · <span className="font-mono">{planSummary}</span>
          </span>
        </button>

        <button type="button" onClick={onEditStart} className={PILL_CLASS}>
          {start ? (
            <>
              <span className="text-ink-3 font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
                From
              </span>
              <span
                className={`truncate ${startLabel ? '' : 'font-mono tabular-nums'}`}
              >
                {startLabel ?? formatCoordinates(start)}
              </span>
            </>
          ) : (
            <span>Set a start point</span>
          )}
        </button>
      </div>

      <div className="pointer-events-auto flex gap-2">
        <button
          type="button"
          aria-label="Follow my position"
          aria-pressed={follow}
          onClick={onToggleFollow}
          className={`${ICON_BUTTON_CLASS} ${follow ? 'text-moss' : ''}`}
        >
          <span aria-hidden="true">◎</span>
        </button>
        <button
          type="button"
          aria-label="History"
          onClick={onOpenHistory}
          className={ICON_BUTTON_CLASS}
        >
          <span aria-hidden="true">🕘</span>
        </button>
      </div>
    </div>
  )
}
