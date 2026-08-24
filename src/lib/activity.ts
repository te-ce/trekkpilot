export type ActivityType = 'cycling' | 'trekking'

export function isActivityType(value: unknown): value is ActivityType {
  return value === 'cycling' || value === 'trekking'
}

/** Default average speed per activity, in km/h, used to derive a target distance from a duration. */
export const DEFAULT_SPEED_KMH: Record<ActivityType, number> = {
  cycling: 15,
  trekking: 4.5,
}

export function targetDistanceMeters(
  activity: ActivityType,
  durationMinutes: number,
): number {
  const speedKmh = DEFAULT_SPEED_KMH[activity]
  const hours = durationMinutes / 60
  return speedKmh * hours * 1000
}
