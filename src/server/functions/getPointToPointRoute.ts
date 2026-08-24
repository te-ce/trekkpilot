import { createServerFn } from '@tanstack/react-start'

import { isActivityType } from '#/lib/activity'
import {
  fetchPointToPointRouteCandidates,
  type GeoPoint,
  type PointToPointRouteInput,
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

function validatePoint(point: unknown, label: string): GeoPoint {
  if (typeof point !== 'object' || point === null) {
    throw new Error(`Invalid ${label} point: lat/lon required`)
  }

  const { lat, lon }: { lat?: unknown; lon?: unknown } = point
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error(`Invalid ${label} point: lat/lon must be numbers`)
  }

  return { lat, lon }
}

export function validatePointToPointRouteInput(
  input: unknown,
): PointToPointRouteInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid point-to-point route request')
  }

  const {
    activity,
    start,
    stop,
    elevationMetric,
  }: {
    activity?: unknown
    start?: unknown
    stop?: unknown
    elevationMetric?: unknown
  } = input

  if (!isActivityType(activity)) {
    throw new Error('Invalid activity: must be "cycling" or "trekking"')
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
    start: validatePoint(start, 'start'),
    stop: validatePoint(stop, 'stop'),
    elevationMetric: elevationMetric ?? 'ascent',
  }
}

/**
 * Returns the scored point-to-point route alternatives, sorted best-first,
 * between a fixed start and stop point (see fetchPointToPointRouteCandidates
 * / scoring.ts). This is the serverless boundary — the ORS API key never
 * reaches the client. Return-trip routing is explicitly out of scope (issue
 * 004) — only the outbound leg is fetched.
 */
export const getPointToPointRoute = createServerFn({ method: 'POST' })
  .validator(validatePointToPointRouteInput)
  .handler(async ({ data }) => fetchPointToPointRouteCandidates(data))
