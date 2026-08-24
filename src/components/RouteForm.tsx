import { LocationPicker, type GeoPoint } from '#/components/LocationPicker'
import { isActivityType, type ActivityType } from '#/lib/activity'
import type { ElevationMetricType } from '#/server/scoring'

export type RouteMode = 'loop' | 'pointToPoint'

function isRouteMode(value: string): value is RouteMode {
  return value === 'loop' || value === 'pointToPoint'
}

function isElevationMetricType(value: string): value is ElevationMetricType {
  return value === 'ascent' || value === 'netChange' || value === 'maxGradient'
}

export function RouteForm({
  mode,
  onModeChange,
  activity,
  onActivityChange,
  durationMinutes,
  onDurationMinutesChange,
  elevationMetric,
  onElevationMetricChange,
  start,
  onStartChange,
  stop,
  onStopChange,
  onError,
  isLoading,
  onSubmit,
}: {
  mode: RouteMode
  onModeChange: (mode: RouteMode) => void
  activity: ActivityType
  onActivityChange: (activity: ActivityType) => void
  durationMinutes: number
  onDurationMinutesChange: (durationMinutes: number) => void
  elevationMetric: ElevationMetricType
  onElevationMetricChange: (elevationMetric: ElevationMetricType) => void
  start: GeoPoint | null
  onStartChange: (point: GeoPoint) => void
  stop: GeoPoint | null
  onStopChange: (point: GeoPoint) => void
  onError: (error: string) => void
  isLoading: boolean
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="mode">Mode</label>
      <select
        id="mode"
        value={mode}
        onChange={(event) => {
          if (isRouteMode(event.target.value)) {
            onModeChange(event.target.value)
          }
        }}
      >
        <option value="loop">Loop (back to start)</option>
        <option value="pointToPoint">Point-to-point</option>
      </select>

      <label htmlFor="activity">Activity</label>
      <select
        id="activity"
        value={activity}
        onChange={(event) => {
          if (isActivityType(event.target.value)) {
            onActivityChange(event.target.value)
          }
        }}
      >
        <option value="cycling">Cycling</option>
        <option value="trekking">Trekking</option>
      </select>

      {mode === 'loop' && (
        <>
          <label htmlFor="duration">Target duration (minutes)</label>
          <input
            id="duration"
            type="number"
            value={durationMinutes}
            onChange={(event) =>
              onDurationMinutesChange(Number(event.target.value))
            }
          />
        </>
      )}

      <label htmlFor="elevation-metric">Elevation metric</label>
      <select
        id="elevation-metric"
        value={elevationMetric}
        onChange={(event) => {
          if (isElevationMetricType(event.target.value)) {
            onElevationMetricChange(event.target.value)
          }
        }}
      >
        <option value="ascent">Total ascent</option>
        <option value="netChange">Net elevation change</option>
        <option value="maxGradient">Max gradient</option>
      </select>

      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={start}
        onChange={onStartChange}
        onError={onError}
        showCurrentLocation
      />

      {mode === 'pointToPoint' && (
        <LocationPicker
          legend="Stop point"
          idPrefix="stop"
          value={stop}
          onChange={onStopChange}
          onError={onError}
        />
      )}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Finding route…' : 'Get route'}
      </button>
    </form>
  )
}
