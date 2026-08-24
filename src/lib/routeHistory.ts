import type { ActivityType } from '#/lib/activity'
import type { GeoPoint } from '#/components/LocationPicker'
import type { RouteMode } from '#/lib/routeMode'
import type { LoopRouteCandidate } from '#/server/ors'

const HISTORY_KEY = 'trekkpilot-route-history'

/** Keep only the most recent entries so localStorage doesn't grow unbounded. */
const MAX_HISTORY_ENTRIES = 30

export type HistoryEntry = {
  id: string
  activity: ActivityType
  /**
   * Loop or point-to-point. Entries written before this field existed read
   * back as 'loop', which is what the app could only produce back then.
   */
  mode: RouteMode
  /** Target duration the loop was planned for; meaningless for point-to-point. */
  durationMinutes: number
  /** Start point the route was generated from, needed to redisplay it on RouteMap. */
  start: GeoPoint
  /** Full scored candidate (coordinates + metrics + score), enough to redisplay and re-export the route. */
  candidate: LoopRouteCandidate
  /** Denormalized from candidate.score for convenient display in the history list. */
  score: number
  /** Date.now() at save time. */
  timestamp: number
}

export type SaveRouteToHistoryInput = {
  activity: ActivityType
  /** Defaults to 'loop' for callers that predate point-to-point. */
  mode?: RouteMode
  durationMinutes: number
  start: GeoPoint
  candidate: LoopRouteCandidate
}

/** Formats a history entry's saved-at timestamp for display, e.g. "2026-08-24 14:05". */
export function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${datePart} ${timePart}`
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Reads saved route history from localStorage. Returns an empty array if
 * nothing has been saved yet, or if the stored value is missing/corrupt —
 * this module is device-local, best-effort storage, not a source of truth
 * that needs to surface parse errors to the user.
 */
/** How an entry may actually look in storage: `mode` postdates the first entries. */
type StoredHistoryEntry = Omit<HistoryEntry, 'mode'> & { mode?: RouteMode }

export function getRouteHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) {
      return []
    }
    const parsed: StoredHistoryEntry[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((entry) => ({ ...entry, mode: entry.mode ?? 'loop' }))
  } catch {
    return []
  }
}

/**
 * Appends a new history entry and writes the (capped) list back to
 * localStorage. Device-local only — no sync, no account, no backend.
 */
export function saveRouteToHistory(input: SaveRouteToHistoryInput): void {
  const entry: HistoryEntry = {
    id: generateId(),
    activity: input.activity,
    mode: input.mode ?? 'loop',
    durationMinutes: input.durationMinutes,
    start: input.start,
    candidate: input.candidate,
    score: input.candidate.score,
    timestamp: Date.now(),
  }

  const existing = getRouteHistory()
  const updated = [...existing, entry].slice(-MAX_HISTORY_ENTRIES)

  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}
