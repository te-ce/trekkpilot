import { LocationPicker, type GeoPoint } from '#/components/LocationPicker'
import { SegmentedControl } from '#/components/SegmentedControl'
import {
  DEFAULT_SPEED_KMH,
  targetDistanceMeters,
  type ActivityType,
} from '#/lib/activity'
import { PRIMARY_BUTTON_CLASS } from '#/lib/controlStyles'
import { ACTIVITY_LABELS, formatDurationLabel } from '#/lib/labels'
import { formatDistance } from '#/lib/ranking'
import type { RouteMode } from '#/lib/routeMode'

/** The durations a person actually plans around, as chips. */
const DURATION_PRESETS = [30, 60, 90, 120]

const DURATION_OPTIONS = DURATION_PRESETS.map((minutes) => ({
  value: String(minutes),
  label: formatDurationLabel(minutes),
}))

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
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
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
        <div>
          <SegmentedControl
            label="Time out"
            name="duration"
            options={DURATION_OPTIONS}
            value={String(durationMinutes)}
            onChange={(value) => onDurationMinutesChange(Number(value))}
          />
          <p className="text-ink-3 mt-1.5 font-mono text-xs tabular-nums">
            ≈ {formatDistance(targetDistanceMeters(activity, durationMinutes))}{' '}
            at {DEFAULT_SPEED_KMH[activity]} km/h
          </p>
        </div>
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
