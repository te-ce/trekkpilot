/**
 * Reading the duration the user typed into the plan.
 *
 * The field is free-form on purpose — a person's outing is rarely one of four
 * round numbers — so this is where a typed string becomes either a number of
 * minutes worth searching for, or the sentence explaining why it is not.
 */

/** What the plan opens with: an hour out. */
export const DEFAULT_DURATION_MINUTES = 60

/**
 * The longest single outing the plan will search for, in minutes.
 *
 * A sanity bound, not a rule about fitness: a loop search spends five ORS
 * requests before it can fail, and an absurd duration (a typo'd `600` meant as
 * `60`, or a stray extra digit) asks for a `round_trip` length far past what
 * ORS will route at all — so it buys nothing but a slow failure. Eight hours
 * is a full day out at either activity's default speed, which is more than
 * anyone plans in one go here.
 */
export const MAX_DURATION_MINUTES = 480

const MAX_HOURS = MAX_DURATION_MINUTES / 60

/** A duration read from the field: the minutes to search for, or why we can't. */
export type ParsedDuration = { minutes: number } | { error: string }

export function parseDurationMinutes(raw: string): ParsedDuration {
  const trimmed = raw.trim()
  const minutes = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(minutes)) {
    return {
      error: 'Enter how many minutes you want to be out — 60, for example.',
    }
  }
  if (minutes <= 0) {
    return { error: 'Enter more than 0 minutes — 60, for example.' }
  }
  if (minutes > MAX_DURATION_MINUTES) {
    return {
      error: `That is longer than one outing. Enter ${String(MAX_DURATION_MINUTES)} minutes (${String(MAX_HOURS)} h) or less.`,
    }
  }
  return { minutes }
}
