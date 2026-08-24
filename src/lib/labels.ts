/**
 * How the UI words things: durations on pills and rows, coordinates in the
 * start pill, and the label/value pair for whichever elevation metric the user
 * is reading routes by. Pure string work, kept out of the components so the
 * wording can be asserted directly.
 */

import type { ActivityType } from '#/lib/activity'
import type { CandidateMetrics, ElevationMetricType } from '#/server/scoring'

const MINUTES_PER_HOUR = 60

/**
 * A duration the user asked for, worded the way a person says it: "30 min",
 * "1 h", "1 h 47" — which is what keeps an arbitrary number of minutes
 * readable in the plan pill. Distinct from `formatDuration`, which words a *measured*
 * route duration in seconds and always spells out the minutes.
 */
export function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR
  if (hours === 0) {
    return `${rest} min`
  }
  if (rest === 0) {
    return `${hours} h`
  }
  return `${hours} h ${rest}`
}

/** Short coordinates for the start pill, when there is no place name to show. */
export function formatCoordinates(point: { lat: number; lon: number }): string {
  return `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`
}

export const ACTIVITY_LABELS: Record<
  ActivityType,
  { name: string; icon: string }
> = {
  cycling: { name: 'Cycling', icon: '🚲' },
  trekking: { name: 'Trekking', icon: '🥾' },
}

export const ELEVATION_METRIC_LABELS: Record<ElevationMetricType, string> = {
  ascent: 'Total ascent',
  netChange: 'Net elevation change',
  maxGradient: 'Max gradient',
}

/** Percentage wording for the 0..1 ratios in the metrics line. */
export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Label + formatted value for the elevation metric the user is reading routes by. */
export function elevationMetricDisplay(
  elevationMetric: ElevationMetricType,
  metrics: CandidateMetrics,
): { label: string; value: string } {
  const label = ELEVATION_METRIC_LABELS[elevationMetric]
  switch (elevationMetric) {
    case 'netChange':
      return {
        label,
        value: `${Math.round(metrics.netElevationChangeMeters ?? 0)} m`,
      }
    case 'maxGradient':
      return {
        label,
        value: `${(metrics.maxGradientPercent ?? 0).toFixed(1)}%`,
      }
    case 'ascent':
      return { label, value: `${Math.round(metrics.ascentMeters)} m` }
  }
}
