import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { LocationPicker, type GeoPoint } from '#/components/LocationPicker'
import { RouteMap } from '#/components/RouteMap'
import { isActivityType, type ActivityType } from '#/lib/activity'
import { buildGoogleMapsUrl } from '#/lib/googleMaps'
import { downloadGpx } from '#/lib/gpx'
import { useLiveGeolocation } from '#/lib/useLiveGeolocation'
import { getLoopRoute } from '#/server/functions/getLoopRoute'
import { getPointToPointRoute } from '#/server/functions/getPointToPointRoute'
import type { LoopRouteCandidate } from '#/server/ors'
import type { CandidateMetrics, ElevationMetricType } from '#/server/scoring'

export const Route = createFileRoute('/')({ component: Home })

/**
 * 'loop' fetches round-trip loops back to the start (issues 001-003).
 * 'pointToPoint' routes a single outbound leg between a start and a
 * different stop point via ORS alternative_routes (issue 004);
 * return-trip routing is explicitly out of scope.
 */
type RouteMode = 'loop' | 'pointToPoint'

function isRouteMode(value: string): value is RouteMode {
  return value === 'loop' || value === 'pointToPoint'
}

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function isElevationMetricType(value: string): value is ElevationMetricType {
  return value === 'ascent' || value === 'netChange' || value === 'maxGradient'
}

/** Label + formatted value for the currently-selected elevation metric, for candidate display. */
function elevationMetricDisplay(
  elevationMetric: ElevationMetricType,
  metrics: CandidateMetrics,
): { label: string; value: string } {
  switch (elevationMetric) {
    case 'netChange':
      return {
        label: 'Net elevation change',
        value: `${Math.round(metrics.netElevationChangeMeters ?? 0)} m`,
      }
    case 'maxGradient':
      return {
        label: 'Max gradient',
        value: `${(metrics.maxGradientPercent ?? 0).toFixed(1)}%`,
      }
    case 'ascent':
      return {
        label: 'Ascent',
        value: `${Math.round(metrics.ascentMeters)} m`,
      }
  }
}

function toTuple(point: GeoPoint): [number, number] {
  return [point.lat, point.lon]
}

/** Builds the optional `livePosition` prop for RouteMap, respecting exactOptionalPropertyTypes. */
function livePositionProp(
  livePosition: GeoPoint | null,
): { livePosition: [number, number] } | Record<string, never> {
  return livePosition ? { livePosition: toTuple(livePosition) } : {}
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
  const livePosition = useLiveGeolocation(selectedIndex !== null)

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

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleGetRoute()
        }}
      >
        <label htmlFor="mode">Mode</label>
        <select
          id="mode"
          value={mode}
          onChange={(event) => {
            if (isRouteMode(event.target.value)) {
              setMode(event.target.value)
            }
          }}
        >
          <option value="loop">Loop (back to start)</option>
          <option value="pointToPoint">Point-to-point</option>
        </select>

        <label htmlFor="activity">Activity</label>
        <select
          id="activity"
          value={activity}
          onChange={(event) => {
            if (isActivityType(event.target.value)) {
              setActivity(event.target.value)
            }
          }}
        >
          <option value="cycling">Cycling</option>
          <option value="trekking">Trekking</option>
        </select>

        {mode === 'loop' && (
          <>
            <label htmlFor="duration">Target duration (minutes)</label>
            <input
              id="duration"
              type="number"
              value={durationMinutes}
              onChange={(event) =>
                setDurationMinutes(Number(event.target.value))
              }
            />
          </>
        )}

        <label htmlFor="elevation-metric">Elevation metric</label>
        <select
          id="elevation-metric"
          value={elevationMetric}
          onChange={(event) => {
            if (isElevationMetricType(event.target.value)) {
              setElevationMetric(event.target.value)
            }
          }}
        >
          <option value="ascent">Total ascent</option>
          <option value="netChange">Net elevation change</option>
          <option value="maxGradient">Max gradient</option>
        </select>

        <LocationPicker
          legend="Start point"
          idPrefix="start"
          value={start}
          onChange={setStart}
          onError={setError}
          showCurrentLocation
        />

        {mode === 'pointToPoint' && (
          <LocationPicker
            legend="Stop point"
            idPrefix="stop"
            value={stop}
            onChange={setStop}
            onError={setError}
          />
        )}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Finding route…' : 'Get route'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {candidates.length > 0 && start && (
        <section aria-label="Route candidates">
          <h2>Top {candidates.length} route candidates</h2>
          <ul>
            {candidates.map((candidate, index) => (
              <li key={index}>
                <h3>Candidate {index + 1}</h3>
                <RouteMap
                  start={[start.lat, start.lon]}
                  coordinates={candidate.coordinates}
                />
                <dl>
                  <dt>Score</dt>
                  <dd>{candidate.score.toFixed(1)}</dd>
                  <dt>
                    {
                      elevationMetricDisplay(elevationMetric, candidate.metrics)
                        .label
                    }
                  </dt>
                  <dd>
                    {
                      elevationMetricDisplay(elevationMetric, candidate.metrics)
                        .value
                    }
                  </dd>
                  <dt>Turns</dt>
                  <dd>{candidate.metrics.turnCount}</dd>
                  <dt>Dedicated cycleway/footway</dt>
                  <dd>{formatRatio(candidate.metrics.pathTypeRatio)}</dd>
                  <dt>Construction penalty</dt>
                  <dd>{formatRatio(candidate.metrics.constructionPenalty)}</dd>
                </dl>
                <button type="button" onClick={() => setSelectedIndex(index)}>
                  Use this route
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedIndex !== null &&
        start &&
        (() => {
          const activeCandidate = candidates[selectedIndex]
          if (!activeCandidate) {
            return null
          }
          return (
            <section aria-label="Active route" data-testid="active-route">
              <h2>Active route: Candidate {selectedIndex + 1}</h2>
              <RouteMap
                start={[start.lat, start.lon]}
                coordinates={activeCandidate.coordinates}
                {...livePositionProp(livePosition)}
              />
              <p>
                <strong>Exact route (GPX):</strong> reproduces the scored route
                exactly. <strong>Approximate (Google Maps):</strong> Google Maps
                recalculates directions through these points, so it may deviate
                from the scored route.
              </p>
              <button
                type="button"
                onClick={() =>
                  downloadGpx(
                    { coordinates: activeCandidate.coordinates },
                    `trekkpilot-candidate-${selectedIndex + 1}.gpx`,
                  )
                }
              >
                Export GPX
              </button>
              <a
                href={buildGoogleMapsUrl(activeCandidate.coordinates)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Maps
              </a>
            </section>
          )
        })()}
    </main>
  )
}
