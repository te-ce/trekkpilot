import { createServerFn } from '@tanstack/react-start'

import { isActivityType } from '#/lib/activity'
import {
  fetchLoopRoute,
  type GeoPoint,
  type LoopRouteInput,
} from '#/server/ors'

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
  }: { activity?: unknown; start?: unknown; durationMinutes?: unknown } = input

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

  return {
    activity,
    start: validateStart(start),
    durationMinutes,
  }
}

export const getLoopRoute = createServerFn({ method: 'POST' })
  .validator(validateLoopRouteInput)
  .handler(async ({ data }) => fetchLoopRoute(data))
