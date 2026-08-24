import {
  DEFAULT_SPEED_KMH,
  targetDistanceMeters,
  type ActivityType,
} from '#/lib/activity'
import { FIELD_CLASS, MICRO_LABEL_CLASS } from '#/lib/controlStyles'
import { formatDistance } from '#/lib/ranking'

/**
 * How long the user wants to be out, as a free-form number of minutes, with the
 * distance that works out to underneath — the line that makes an arbitrary
 * number legible — or the reason the number cannot be searched for.
 */
export function DurationField({
  draft,
  onDraftChange,
  activity,
  minutes,
  error,
}: {
  draft: string
  onDraftChange: (value: string) => void
  activity: ActivityType
  /** The searchable duration the draft parses to, or null while it doesn't. */
  minutes: number | null
  error: string | null
}) {
  const derivedDistance =
    minutes === null
      ? '—'
      : formatDistance(targetDistanceMeters(activity, minutes))

  return (
    <div>
      <label htmlFor="duration" className={`mb-1.5 block ${MICRO_LABEL_CLASS}`}>
        Duration (minutes)
      </label>
      <input
        id="duration"
        // `inputMode` is what gets a phone to show a numeric keypad; no
        // `min`/`max`/`step="1"` here on purpose, so the browser's own
        // validation bubble never pre-empts the wording below.
        type="number"
        inputMode="numeric"
        step="any"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby="duration-note"
        className={`${FIELD_CLASS} font-mono tabular-nums`}
      />
      <p
        id="duration-note"
        {...(error ? { role: 'alert' as const } : {})}
        className={
          error
            ? 'text-waymark mt-1.5 text-sm'
            : 'text-ink-3 mt-1.5 font-mono text-xs tabular-nums'
        }
      >
        {error ??
          `≈ ${derivedDistance} at ${String(DEFAULT_SPEED_KMH[activity])} km/h`}
      </p>
    </div>
  )
}
