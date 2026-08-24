import { useState } from 'react'

import { LocationPicker, type GeoPoint } from '#/components/LocationPicker'
import { DurationField } from '#/components/DurationField'
import { SegmentedControl } from '#/components/SegmentedControl'
import type { ActivityType } from '#/lib/activity'
import { PRIMARY_BUTTON_CLASS } from '#/lib/controlStyles'
import { parseDurationMinutes } from '#/lib/duration'
import { ACTIVITY_LABELS } from '#/lib/labels'
import type { RouteMode } from '#/lib/routeMode'

const MODE_OPTIONS: { value: RouteMode; label: string }[] = [
  { value: 'loop', label: 'Loop' },
  { value: 'pointToPoint', label: 'A→B' },
]

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'cycling', label: ACTIVITY_LABELS.cycling.name },
  { value: 'trekking', label: ACTIVITY_LABELS.trekking.name },
]

/** What the plan asks for, in the words the user chose it with. */
export function PlanPanel({
  mode,
  onModeChange,
  activity,
  onActivityChange,
  durationMinutes,
  onDurationMinutesChange,
  start,
  startLabel,
  onStartChange,
  stop,
  stopLabel,
  onStopChange,
  onError,
  onSubmit,
}: {
  mode: RouteMode
  onModeChange: (mode: RouteMode) => void
  activity: ActivityType
  onActivityChange: (activity: ActivityType) => void
  durationMinutes: number
  onDurationMinutesChange: (durationMinutes: number) => void
  start: GeoPoint | null
  startLabel: string | null
  onStartChange: (point: GeoPoint, label?: string) => void
  stop: GeoPoint | null
  stopLabel: string | null
  onStopChange: (point: GeoPoint, label?: string) => void
  onError: (message: string) => void
  onSubmit: () => void
}) {
  /**
   * The duration lives here as the text the user typed, not as a number: an
   * empty field or a half-typed value has no number to report upwards, and
   * snapping it to one would fight the person doing the typing. The parent
   * only hears about durations worth searching for.
   */
  const [draft, setDraft] = useState(String(durationMinutes))
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const parsed = parseDurationMinutes(draft)
  // Held back until a search is asked for, so the field doesn't scold anyone
  // mid-keystroke — but once shown it tracks every further edit.
  const durationError =
    submitAttempted && 'error' in parsed ? parsed.error : null

  function handleDurationChange(value: string) {
    setDraft(value)
    const next = parseDurationMinutes(value)
    if ('minutes' in next) {
      onDurationMinutesChange(next.minutes)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        // Point-to-point ignores the duration entirely, so a bad number there
        // is not a reason to withhold a route.
        if (mode === 'loop' && 'error' in parsed) {
          setSubmitAttempted(true)
          return
        }
        setSubmitAttempted(false)
        onSubmit()
      }}
    >
      <h2 className="text-ink text-lg font-semibold">
        {mode === 'loop' ? 'Plan a loop' : 'Plan a route to somewhere'}
      </h2>

      <SegmentedControl
        label="Shape"
        name="mode"
        options={MODE_OPTIONS}
        value={mode}
        onChange={onModeChange}
      />

      <SegmentedControl
        label="Activity"
        name="activity"
        options={ACTIVITY_OPTIONS}
        value={activity}
        onChange={onActivityChange}
      />

      {mode === 'loop' && (
        <DurationField
          draft={draft}
          onDraftChange={handleDurationChange}
          activity={activity}
          minutes={'minutes' in parsed ? parsed.minutes : null}
          error={durationError}
        />
      )}

      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={start}
        valueLabel={startLabel}
        onChange={onStartChange}
        onError={onError}
        showCurrentLocation
        hint="Tap the map to drop a pin, or:"
      />

      {mode === 'pointToPoint' && (
        <LocationPicker
          legend="Stop point"
          idPrefix="stop"
          value={stop}
          valueLabel={stopLabel}
          onChange={onStopChange}
          onError={onError}
          hint="Search for where you want to end up:"
        />
      )}

      <button type="submit" className={PRIMARY_BUTTON_CLASS}>
        Find 3 routes
      </button>
    </form>
  )
}
