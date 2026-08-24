import { createServerFn } from '@tanstack/react-start'

import { isActivityType } from '#/lib/activity'
import {
  fetchLoopRouteCandidates,
  type GeoPoint,
  type LoopRouteInput,
} from '#/server/ors'
import type { ElevationMetricType } from '#/server/scoring'

const ELEVATION_METRIC_TYPES: readonly string[] = [
  'ascent',
  'netChange',
  'maxGradient',
] satisfies ElevationMetricType[]

function isElevationMetricType(value: unknown): value is ElevationMetricType {
  return typeof value === 'string' && ELEVATION_METRIC_TYPES.includes(value)
}

function validateStart(start: unknown): GeoPoint {
  if (typeof start !== 'object' || start === null) {
    throw new Error('Invalid start point: lat/lon required')
  }

  const { lat, lon }: { lat?: unknown; lon?: unknown } = start
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Invalid start point: lat/lon must be numbers')
  }

  return { lat, lon }
}

export function validateLoopRouteInput(input: unknown): LoopRouteInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid loop route request')
  }

  const {
    activity,
    start,
    durationMinutes,
    elevationMetric,
  }: {
    activity?: unknown
    start?: unknown
    durationMinutes?: unknown
    elevationMetric?: unknown
  } = input

  if (!isActivityType(activity)) {
    throw new Error('Invalid activity: must be "cycling" or "trekking"')
  }

  if (
    typeof durationMinutes !== 'number' ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new Error('Invalid duration: must be a positive number of minutes')
  }

  if (
    elevationMetric !== undefined &&
    !isElevationMetricType(elevationMetric)
  ) {
    throw new Error(
      'Invalid elevationMetric: must be "ascent", "netChange", or "maxGradient"',
    )
  }

  return {
    activity,
    start: validateStart(start),
    durationMinutes,
    elevationMetric: elevationMetric ?? 'ascent',
  }
}

/**
 * Returns the scored loop-route candidates, sorted best-first, for the given
 * activity, start point and duration (see fetchLoopRouteCandidates /
 * scoring.ts). This is the serverless boundary — the ORS API key never
 * reaches the client.
 */
export const getLoopRoute = createServerFn({ method: 'POST' })
  .validator(validateLoopRouteInput)
  .handler(async ({ data }) => fetchLoopRouteCandidates(data))
