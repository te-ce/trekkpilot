import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ActivePanel, type ActiveRoute } from '#/components/ActivePanel'
import { BottomSheet } from '#/components/BottomSheet'
import { HistoryPanel } from '#/components/HistoryPanel'
import { LoadingPanel } from '#/components/LoadingPanel'
import { MapCanvas } from '#/components/MapCanvas'
import { type GeoPoint } from '#/components/LocationPicker'
import { PlanPanel } from '#/components/PlanPanel'
import { ResultsPanel } from '#/components/ResultsPanel'
import type { RoutePolyline } from '#/components/RouteMap'
import { TopPillBar } from '#/components/TopPillBar'
import type { ActivityType } from '#/lib/activity'
import {
  rankCandidates,
  ROUTE_COLORS,
  type RankBy,
  type RankedCandidate,
} from '#/lib/ranking'
import {
  formatHistoryDate,
  getRouteHistory,
  saveRouteToHistory,
  type HistoryEntry,
} from '#/lib/routeHistory'
import type { RouteMode } from '#/lib/routeMode'
import { resolveSheetState, type SheetIntent } from '#/lib/sheetState'
import { useLiveGeolocation } from '#/lib/useLiveGeolocation'
import { getLoopRoute } from '#/server/functions/getLoopRoute'
import { getPointToPointRoute } from '#/server/functions/getPointToPointRoute'
import type { LoopRouteCandidate } from '#/server/ors'
import type { ElevationMetricType } from '#/server/scoring'

export const Route = createFileRoute('/')({ component: Home })

/** Labels the sheet by what it is currently showing. */
const SHEET_LABELS = {
  plan: 'Plan your route',
  loading: 'Finding routes',
  results: 'Route options',
  active: 'Your route',
  history: 'Saved routes',
} as const

/** Builds the optional `livePosition` prop, respecting exactOptionalPropertyTypes. */
function livePositionProp(
  livePosition: GeoPoint | null,
): { livePosition: [number, number] } | Record<string, never> {
  return livePosition
    ? { livePosition: [livePosition.lat, livePosition.lon] }
    : {}
}

/**
 * What the map draws: every fetched candidate at once, each keeping the colour
 * its position in the fetched set gave it, so a re-rank never swaps colours out
 * from under the reader. A reopened history entry is a set of one.
 */
function buildRoutePolylines(
  candidates: LoopRouteCandidate[],
  selectedIndex: number | null,
  historyEntry: HistoryEntry | null,
): RoutePolyline[] {
  if (historyEntry) {
    return [
      {
        id: 'history-route',
        coordinates: historyEntry.candidate.coordinates,
        color: ROUTE_COLORS[0] ?? '',
        isActive: true,
      },
    ]
  }
  return candidates.map((candidate, index) => ({
    id: `candidate-${index}`,
    coordinates: candidate.coordinates,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length] ?? '',
    isActive: index === selectedIndex,
  }))
}

/**
 * The route the "active" sheet state is about, from whichever source is live:
 * a freshly-picked candidate, or a reopened history entry. The two are mutually
 * exclusive — picking one clears the other.
 */
function computeActiveRoute(
  candidates: LoopRouteCandidate[],
  ranked: RankedCandidate[],
  selectedIndex: number | null,
  historyEntry: HistoryEntry | null,
): ActiveRoute | null {
  const candidate =
    selectedIndex === null ? undefined : candidates[selectedIndex]
  if (selectedIndex !== null && candidate) {
    const rank =
      ranked.findIndex((entry) => entry.originalIndex === selectedIndex) + 1
    return {
      title: `Route #${rank}`,
      candidate,
      color: ROUTE_COLORS[selectedIndex % ROUTE_COLORS.length] ?? '',
      exportIndex: selectedIndex + 1,
    }
  }
  if (historyEntry) {
    return {
      title: `Saved ${formatHistoryDate(historyEntry.timestamp)}`,
      candidate: historyEntry.candidate,
      color: ROUTE_COLORS[0] ?? '',
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
  const [rankBy, setRankBy] = useState<RankBy>('balanced')
  const [start, setStart] = useState<GeoPoint | null>(null)
  const [startLabel, setStartLabel] = useState<string | null>(null)
  const [stop, setStop] = useState<GeoPoint | null>(null)
  const [stopLabel, setStopLabel] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<LoopRouteCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [activeHistoryEntry, setActiveHistoryEntry] =
    useState<HistoryEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [follow, setFollow] = useState(false)
  const [intent, setIntent] = useState<SheetIntent>('plan')

  const ranked = rankCandidates(candidates, rankBy, elevationMetric)
  const activeRoute = computeActiveRoute(
    candidates,
    ranked,
    selectedIndex,
    activeHistoryEntry,
  )
  const livePosition = useLiveGeolocation(activeRoute !== null)

  const sheetState = resolveSheetState({
    intent,
    isLoading,
    hasCandidates: candidates.length > 0,
    hasActiveRoute: activeRoute !== null,
  })

  function handleStartChange(point: GeoPoint, label?: string) {
    setStart(point)
    setStartLabel(label ?? null)
  }

  function handleStopChange(point: GeoPoint, label?: string) {
    setStop(point)
    setStopLabel(label ?? null)
  }

  /**
   * Saves the picked route to device-local history (issue 008) and makes it the
   * active one. Saving on selection keeps the trigger single-sourced: an export
   * only ever happens after a selection.
   */
  function handleSelectCandidate(originalIndex: number) {
    const candidate = candidates[originalIndex]
    if (start && candidate) {
      saveRouteToHistory({ activity, mode, durationMinutes, start, candidate })
    }
    setActiveHistoryEntry(null)
    setSelectedIndex(originalIndex)
    setIntent('active')
  }

  function openHistory() {
    setHistoryEntries(getRouteHistory())
    setIntent('history')
  }

  /** Reopens a saved route (issue 008) as the active one. */
  function viewHistoryEntry(entry: HistoryEntry) {
    setSelectedIndex(null)
    setActiveHistoryEntry(entry)
    setIntent('active')
  }

  /**
   * Fetches candidates. The server fetches 5 route options and keeps the top 3
   * by score, using this same `elevationMetric` for the elevation term; the
   * client then re-ranks those 3 (see `rankCandidates`) without refetching, so
   * changing the ranking or the elevation metric afterwards costs nothing.
   */
  async function handleGetRoute() {
    if (!start) {
      setError('Pick a start point first — tap the map, or use your location.')
      return
    }
    if (mode === 'pointToPoint' && !stop) {
      setError('Pick where you want to end up first.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSelectedIndex(null)
    setActiveHistoryEntry(null)
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
      setIntent('results')
    } catch {
      setError('Could not fetch a route. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function sheetContent() {
    switch (sheetState) {
      case 'loading':
        return <LoadingPanel />
      case 'history':
        return (
          <HistoryPanel
            entries={historyEntries}
            onView={viewHistoryEntry}
            onBack={() => setIntent(candidates.length > 0 ? 'results' : 'plan')}
          />
        )
      case 'results':
        return (
          <ResultsPanel
            mode={mode}
            ranked={ranked}
            rankBy={rankBy}
            onRankByChange={setRankBy}
            elevationMetric={elevationMetric}
            onElevationMetricChange={setElevationMetric}
            selectedIndex={selectedIndex}
            onSelect={handleSelectCandidate}
          />
        )
      case 'active':
        return (
          activeRoute && (
            <ActivePanel
              route={activeRoute}
              mode={activeHistoryEntry?.mode ?? mode}
              elevationMetric={elevationMetric}
              onStart={() => setFollow(true)}
              onBack={
                candidates.length > 0 && !activeHistoryEntry
                  ? () => setIntent('results')
                  : null
              }
            />
          )
        )
      default:
        return (
          <PlanPanel
            mode={mode}
            onModeChange={setMode}
            activity={activity}
            onActivityChange={setActivity}
            durationMinutes={durationMinutes}
            onDurationMinutesChange={setDurationMinutes}
            start={start}
            startLabel={startLabel}
            onStartChange={handleStartChange}
            stop={stop}
            stopLabel={stopLabel}
            onStopChange={handleStopChange}
            onError={setError}
            onSubmit={() => void handleGetRoute()}
          />
        )
    }
  }

  const pinnedStart = start ?? activeHistoryEntry?.start ?? null

  return (
    <div className="bg-ground relative h-dvh w-full overflow-hidden">
      {/*
        `isolate` matters: Leaflet gives its panes and controls z-indexes in the
        400-800 range, which would otherwise paint over the pills and the sheet.
        Isolating the map keeps those numbers inside this box.
      */}
      <div className="absolute inset-0 isolate z-0">
        <MapCanvas
          start={pinnedStart ? [pinnedStart.lat, pinnedStart.lon] : null}
          routes={buildRoutePolylines(
            candidates,
            selectedIndex,
            activeHistoryEntry,
          )}
          follow={follow}
          onMapClick={handleStartChange}
          {...livePositionProp(livePosition)}
        />
      </div>

      <TopPillBar
        mode={mode}
        activity={activity}
        durationMinutes={durationMinutes}
        start={pinnedStart}
        startLabel={startLabel}
        follow={follow}
        onToggleFollow={() => setFollow((current) => !current)}
        onEditPlan={() => setIntent('plan')}
        onEditStart={() => setIntent('plan')}
        onOpenHistory={openHistory}
      />

      <BottomSheet label={SHEET_LABELS[sheetState]}>
        {sheetContent()}
      </BottomSheet>

      {error && (
        <p
          role="alert"
          className="border-waymark bg-surface text-ink absolute inset-x-3 top-20 z-40 rounded-xl border px-3 py-2 text-sm shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  )
}
