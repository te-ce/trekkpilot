import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ActivePanel, type ActiveRoute } from '#/components/ActivePanel'
import { BottomSheet } from '#/components/BottomSheet'
import { HistoryPanel } from '#/components/HistoryPanel'
import { LoadingPanel } from '#/components/LoadingPanel'
import { MapCanvas } from '#/components/MapCanvas'
import { type GeoPoint } from '#/components/LocationPicker'
import { PlanPanel } from '#/components/PlanPanel'
import { ResultsPanel } from '#/components/ResultsPanel'
import type { MapJumpRequest, RoutePolyline } from '#/components/RouteMap'
import { TopPillBar } from '#/components/TopPillBar'
import type { ActivityType } from '#/lib/activity'
import { DEFAULT_DURATION_MINUTES } from '#/lib/duration'
import {
  describeGeolocationError,
  logGeolocationError,
} from '#/lib/geolocationError'
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

/** How many candidates are shown before the reader taps "Load more". */
const INITIAL_VISIBLE_COUNT = 3

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

/** Builds the optional `jumpTo` prop, respecting exactOptionalPropertyTypes. */
function jumpToProp(
  jumpTo: MapJumpRequest | null,
): { jumpTo: MapJumpRequest } | Record<string, never> {
  return jumpTo ? { jumpTo } : {}
}

/**
 * What the map draws: every currently-visible candidate (those revealed so far
 * via "load more"), each keeping the colour its position in the fetched set
 * gave it, so a re-rank or a later reveal never swaps colours out from under
 * the reader. A reopened history entry is a set of one.
 */
function buildRoutePolylines(
  candidates: LoopRouteCandidate[],
  visibleOriginalIndices: Set<number>,
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
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => visibleOriginalIndices.has(index))
    .map(({ candidate, index }) => ({
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
  const [durationMinutes, setDurationMinutes] = useState(
    DEFAULT_DURATION_MINUTES,
  )
  const [elevationMetric, setElevationMetric] =
    useState<ElevationMetricType>('ascent')
  const [rankBy, setRankBy] = useState<RankBy>('balanced')
  const [start, setStart] = useState<GeoPoint | null>(null)
  const [startLabel, setStartLabel] = useState<string | null>(null)
  const [stop, setStop] = useState<GeoPoint | null>(null)
  const [stopLabel, setStopLabel] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<LoopRouteCandidate[]>([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [activeHistoryEntry, setActiveHistoryEntry] =
    useState<HistoryEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [follow, setFollow] = useState(false)
  const [jumpTo, setJumpTo] = useState<MapJumpRequest | null>(null)
  const [intent, setIntent] = useState<SheetIntent>('plan')
  const [sheetMinimized, setSheetMinimized] = useState(false)

  // A new sheet intent is always a fresh ask for the user's attention —
  // fetched results, a picked history entry, the plan form reopened — so a
  // prior minimize (from looking at the map) shouldn't hide it.
  function showSheet(nextIntent: SheetIntent) {
    setIntent(nextIntent)
    setSheetMinimized(false)
  }

  const ranked = rankCandidates(candidates, rankBy, elevationMetric)
  const visibleRanked = ranked.slice(0, visibleCount)
  const visibleOriginalIndices = new Set(
    visibleRanked.map((entry) => entry.originalIndex),
  )
  const activeRoute = computeActiveRoute(
    candidates,
    ranked,
    selectedIndex,
    activeHistoryEntry,
  )
  /**
   * Tracking runs when the user has asked to see themselves — they centred the
   * map on their position, switched follow on, or picked a route to walk — and
   * never merely because the page loaded (issue 005): a watch from first paint
   * would drain the battery and pop the permission prompt at people who only
   * came to plan a route. The hook itself still pauses while backgrounded.
   */
  const { position: livePosition, error: liveGeoError } = useLiveGeolocation(
    follow || jumpTo !== null || activeRoute !== null,
  )

  useEffect(() => {
    if (liveGeoError) {
      setError(liveGeoError)
    }
  }, [liveGeoError])

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
    showSheet('active')
  }

  /**
   * Centres the map on where the user is right now, once. Reads a fresh fix
   * with `getCurrentPosition` rather than waiting on the watch, so the first
   * tap moves the map instead of doing nothing until a fix arrives. The
   * incrementing token makes a repeat tap a new request, so the map still comes
   * back after the user has panned away.
   *
   * Deliberately does not touch the start point: seeing where you are and
   * choosing where a route begins are different decisions, and the plan sheet
   * already owns the second one.
   */
  function locateMe() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setJumpTo((previous) => ({
          position: [position.coords.latitude, position.coords.longitude],
          token: (previous?.token ?? 0) + 1,
        }))
      },
      (error) => {
        logGeolocationError('getCurrentPosition', error)
        setError(describeGeolocationError(error))
      },
    )
  }

  /**
   * Centres the map on the user as soon as the page loads, but only if
   * permission is already granted — this must never itself trigger the
   * browser's permission prompt, since arriving at the page is not the same
   * as asking to be located. A denial or missing permission is silent: there
   * is no user action to blame it on.
   */
  useEffect(() => {
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') {
          locateMe()
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react/exhaustive-deps -- run once on mount only, never on locateMe identity
  }, [])

  function openHistory() {
    setHistoryEntries(getRouteHistory())
    showSheet('history')
  }

  /** Reopens a saved route (issue 008) as the active one. */
  function viewHistoryEntry(entry: HistoryEntry) {
    setSelectedIndex(null)
    setActiveHistoryEntry(entry)
    showSheet('active')
  }

  /**
   * Fetches candidates. The server scores and sorts the full candidate pool
   * (up to 5), using this same `elevationMetric` for the elevation term; the
   * client shows the first few and re-ranks whatever is visible (see
   * `rankCandidates`) without refetching, so changing the ranking, the
   * elevation metric, or revealing more candidates afterwards costs nothing.
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
    setVisibleCount(INITIAL_VISIBLE_COUNT)
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
      showSheet('results')
    } catch {
      setError('Could not fetch a route. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  /** Reveals the rest of the fetched candidate pool; nothing left to fetch. */
  function handleLoadMore() {
    setVisibleCount(candidates.length)
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
            onBack={() => showSheet(candidates.length > 0 ? 'results' : 'plan')}
          />
        )
      case 'results':
        return (
          <ResultsPanel
            mode={mode}
            ranked={visibleRanked}
            totalCount={candidates.length}
            onLoadMore={handleLoadMore}
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
                  ? () => showSheet('results')
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
    <div className="bg-ground relative grid h-dvh w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden md:block">
      {/*
        `isolate` matters: Leaflet gives its panes and controls z-indexes in the
        400-800 range, which would otherwise paint over the pills and the sheet.
        Isolating the map keeps those numbers inside this box.

        On mobile the map is a real grid row, not a full-bleed overlay: it
        shrinks in place when the plan sheet below it expands, and grows back
        when the sheet is minimized. From `md` up there's room for both, so it
        reverts to filling the whole screen behind a floating sheet.
      */}
      <div className="relative isolate z-0 min-h-0 md:absolute md:inset-0">
        <MapCanvas
          start={pinnedStart ? [pinnedStart.lat, pinnedStart.lon] : null}
          routes={buildRoutePolylines(
            candidates,
            visibleOriginalIndices,
            selectedIndex,
            activeHistoryEntry,
          )}
          follow={follow}
          onFollowCancel={() => setFollow(false)}
          onMapClick={handleStartChange}
          {...livePositionProp(livePosition)}
          {...jumpToProp(jumpTo)}
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
        onLocateMe={locateMe}
        onEditPlan={() => showSheet('plan')}
        onEditStart={() => showSheet('plan')}
        onOpenHistory={openHistory}
      />

      <BottomSheet
        label={SHEET_LABELS[sheetState]}
        minimized={sheetMinimized}
        onToggleMinimized={() => setSheetMinimized((current) => !current)}
      >
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
