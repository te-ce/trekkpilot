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
      className="flex flex-col gap-3"
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
      {/*
        Kept in the heading outline but out of the sheet: the pill bar over the
        map already says what is being planned, and the sheet's own region label
        names it for assistive tech, so a visible title only cost the map a row.
      */}
      <h2 className="sr-only">
        {mode === 'loop' ? 'Plan a loop' : 'Plan a route to somewhere'}
      </h2>

      {/*
        Shape and activity are each two words wide, so they share one row rather
        than stacking two labelled blocks. Their options say what the choice is
        about, which is what lets the labels go visually quiet.
      */}
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SegmentedControl
            label="Shape"
            labelHidden
            name="mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={onModeChange}
          />
        </div>
        <div className="min-w-0 flex-1">
          <SegmentedControl
            label="Activity"
            labelHidden
            name="activity"
            options={ACTIVITY_OPTIONS}
            value={activity}
            onChange={onActivityChange}
          />
        </div>
      </div>

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
        shortLabel="From"
        idPrefix="start"
        value={start}
        valueLabel={startLabel}
        onChange={onStartChange}
        onError={onError}
        showCurrentLocation
        hint="Tap the map to drop a pin"
      />

      {mode === 'pointToPoint' && (
        <LocationPicker
          legend="Stop point"
          shortLabel="To"
          idPrefix="stop"
          value={stop}
          valueLabel={stopLabel}
          onChange={onStopChange}
          onError={onError}
          hint="Search for where you want to end up"
        />
      )}

      <button type="submit" className={PRIMARY_BUTTON_CLASS}>
        Find 3 routes
      </button>
    </form>
  )
}
