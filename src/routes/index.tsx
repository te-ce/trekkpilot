import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import {
  ActiveRouteSection,
  type ActiveRoute,
} from '#/components/ActiveRouteSection'
import { CandidateList } from '#/components/CandidateList'
import { HistorySection } from '#/components/HistorySection'
import { type GeoPoint } from '#/components/LocationPicker'
import { RouteForm, type RouteMode } from '#/components/RouteForm'
import type { ActivityType } from '#/lib/activity'
import {
  formatHistoryDate,
  getRouteHistory,
  saveRouteToHistory,
  type HistoryEntry,
} from '#/lib/routeHistory'
import { useLiveGeolocation } from '#/lib/useLiveGeolocation'
import { getLoopRoute } from '#/server/functions/getLoopRoute'
import { getPointToPointRoute } from '#/server/functions/getPointToPointRoute'
import type { LoopRouteCandidate } from '#/server/ors'
import type { ElevationMetricType } from '#/server/scoring'

export const Route = createFileRoute('/')({ component: Home })

/**
 * The route currently shown in the "Active route" section, from whichever
 * source is active: the freshly-fetched candidate list (selectedIndex) or a
 * reopened history entry (activeHistoryEntry). The two are mutually
 * exclusive — selecting a fresh candidate clears the history entry and vice
 * versa (see handleSelectCandidate / handleViewHistoryEntry below).
 */
function computeActiveRoute(
  candidates: LoopRouteCandidate[],
  selectedIndex: number | null,
  start: GeoPoint | null,
  activeHistoryEntry: HistoryEntry | null,
): ActiveRoute | null {
  const selectedCandidate =
    selectedIndex !== null ? candidates[selectedIndex] : undefined
  if (selectedIndex !== null && start && selectedCandidate) {
    return {
      label: `Candidate ${selectedIndex + 1}`,
      start,
      candidate: selectedCandidate,
      exportIndex: selectedIndex + 1,
    }
  }
  if (activeHistoryEntry) {
    return {
      label: `History entry from ${formatHistoryDate(activeHistoryEntry.timestamp)}`,
      start: activeHistoryEntry.start,
      candidate: activeHistoryEntry.candidate,
      exportIndex: 1,
    }
  }
  return null
}

export function Home() {
  const [mode, setMode] = useState<RouteMode>('loop')
  const [activity, setActivity] = useState<ActivityType>('cycling')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [elevationMetric, setElevationMetric] =
    useState<ElevationMetricType>('ascent')
  const [start, setStart] = useState<GeoPoint | null>(null)
  const [stop, setStop] = useState<GeoPoint | null>(null)
  const [candidates, setCandidates] = useState<LoopRouteCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [activeHistoryEntry, setActiveHistoryEntry] =
    useState<HistoryEntry | null>(null)
  const livePosition = useLiveGeolocation(
    selectedIndex !== null || activeHistoryEntry !== null,
  )

  const activeRoute = computeActiveRoute(
    candidates,
    selectedIndex,
    start,
    activeHistoryEntry,
  )

  function toggleHistory() {
    if (!isHistoryOpen) {
      setHistoryEntries(getRouteHistory())
    }
    setIsHistoryOpen((open) => !open)
  }

  /**
   * Saves the picked candidate to device-local route history (issue 008) and
   * marks it active. Saving on selection (rather than on export) keeps the
   * trigger simple and single-sourced: export happens after selection in
   * this flow, so a selected route is already captured before any export.
   */
  function handleSelectCandidate(index: number) {
    const candidate = candidates[index]
    if (start && candidate) {
      saveRouteToHistory({ activity, durationMinutes, start, candidate })
    }
    setActiveHistoryEntry(null)
    setSelectedIndex(index)
  }

  /** Reopens a saved history entry (issue 008) as the active route. */
  function handleViewHistoryEntry(entry: HistoryEntry) {
    setSelectedIndex(null)
    setActiveHistoryEntry(entry)
  }

  async function handleGetRoute() {
    if (!start) {
      setError('Pick a start point first (GPS, search, or manual pin).')
      return
    }
    if (mode === 'pointToPoint' && !stop) {
      setError('Pick a stop point first (search or manual pin).')
      return
    }

    setIsLoading(true)
    setError(null)
    setSelectedIndex(null)
    try {
      const result =
        mode === 'pointToPoint' && stop
          ? await getPointToPointRoute({
              data: { activity, start, stop, elevationMetric },
            })
          : await getLoopRoute({
              data: { activity, start, durationMinutes, elevationMetric },
            })
      setCandidates(result)
    } catch {
      setError('Could not fetch a route. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main>
      <h1>TrekkPilot</h1>
      <p>Pick a duration, get a loop route.</p>

      <button type="button" onClick={toggleHistory}>
        {isHistoryOpen ? 'Hide history' : 'History'}
      </button>

      <HistorySection
        isOpen={isHistoryOpen}
        entries={historyEntries}
        onView={handleViewHistoryEntry}
      />

      <RouteForm
        mode={mode}
        onModeChange={setMode}
        activity={activity}
        onActivityChange={setActivity}
        durationMinutes={durationMinutes}
        onDurationMinutesChange={setDurationMinutes}
        elevationMetric={elevationMetric}
        onElevationMetricChange={setElevationMetric}
        start={start}
        onStartChange={setStart}
        stop={stop}
        onStopChange={setStop}
        onError={setError}
        isLoading={isLoading}
        onSubmit={() => void handleGetRoute()}
      />

      {error && <p role="alert">{error}</p>}

      <CandidateList
        candidates={candidates}
        start={start}
        elevationMetric={elevationMetric}
        onSelect={handleSelectCandidate}
      />

      <ActiveRouteSection
        activeRoute={activeRoute}
        livePosition={livePosition}
      />
    </main>
  )
}
