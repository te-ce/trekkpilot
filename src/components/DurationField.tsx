import { useState } from 'react'

import { SegmentedControl } from '#/components/SegmentedControl'
import {
  DEFAULT_SPEED_KMH,
  targetDistanceMeters,
  type ActivityType,
} from '#/lib/activity'
import { FIELD_CLASS } from '#/lib/controlStyles'
import { formatDistance } from '#/lib/ranking'

/**
 * The durations worth a single tap. Four covers what most people ask for, and
 * anything else is still one tap away behind "Other" — the field is not gone,
 * it is just no longer the first thing anyone has to deal with.
 *
 * Labels are deliberately tight rather than run through `formatDurationLabel`:
 * five of them share one row on a phone.
 */
const DURATION_PRESETS = [
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 90, label: '1h30' },
  { minutes: 120, label: '2h' },
] as const

/** The "not one of the four" option, which reveals the free-form field. */
const CUSTOM = 'custom'

const OPTIONS = [
  ...DURATION_PRESETS.map((preset) => ({
    value: String(preset.minutes),
    label: preset.label,
  })),
  { value: CUSTOM, label: 'Other' },
]

/**
 * How long the user wants to be out: four presets, a free-form field for
 * everything else, and underneath either the distance that works out to — the
 * line that makes an arbitrary number legible — or the reason the number
 * cannot be searched for.
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
  /**
   * Set when the user asks for "Other" — the one case a preset value still has
   * to yield the field, because they want to edit that number by hand. Every
   * other reason to show it is already visible in the draft itself.
   */
  const [customRequested, setCustomRequested] = useState(false)

  const matched = DURATION_PRESETS.find(
    (candidate) => String(candidate.minutes) === draft.trim(),
  )
  /**
   * The chip that is on, or null while the free-form field owns the answer — a
   * draft no preset offers, an empty one, or an unparseable one, so an error is
   * never explained next to a field the reader cannot see.
   */
  const preset = customRequested ? null : matched

  const derivedDistance =
    minutes === null
      ? '—'
      : formatDistance(targetDistanceMeters(activity, minutes))

  return (
    <div className="flex flex-col gap-1.5">
      <SegmentedControl
        label="Duration"
        labelHidden
        name="duration-preset"
        options={OPTIONS}
        value={preset ? String(preset.minutes) : CUSTOM}
        onChange={(value) => {
          if (value === CUSTOM) {
            setCustomRequested(true)
            return
          }
          setCustomRequested(false)
          onDraftChange(value)
        }}
      />

      {!preset && (
        <div>
          <label htmlFor="duration" className="sr-only">
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
            placeholder="Minutes"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby="duration-note"
            className={`${FIELD_CLASS} font-mono tabular-nums`}
          />
        </div>
      )}

      <p
        id="duration-note"
        {...(error ? { role: 'alert' as const } : {})}
        className={
          error
            ? 'text-waymark text-sm'
            : 'text-ink-3 font-mono text-xs tabular-nums'
        }
      >
        {error ??
          `≈ ${derivedDistance} at ${String(DEFAULT_SPEED_KMH[activity])} km/h`}
      </p>
    </div>
  )
}
