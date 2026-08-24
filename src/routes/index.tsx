import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { RouteMap } from '#/components/RouteMap'
import { isActivityType, type ActivityType } from '#/lib/activity'
import { getLoopRoute } from '#/server/functions/getLoopRoute'
import type { LoopRouteCandidate } from '#/server/ors'

export const Route = createFileRoute('/')({ component: Home })

type StartPoint = { lat: number; lon: number }

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function Home() {
  const [activity, setActivity] = useState<ActivityType>('cycling')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [start, setStart] = useState<StartPoint | null>(null)
  const [candidates, setCandidates] = useState<LoopRouteCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function useCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStart({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () => {
        setError('Could not read the current GPS location.')
      },
    )
  }

  function setPinManually() {
    const lat = Number(manualLat)
    const lon = Number(manualLon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setError('Latitude and longitude must be numbers.')
      return
    }
    setStart({ lat, lon })
    setError(null)
  }

  async function handleGetRoute() {
    if (!start) {
      setError('Pick a start point first (GPS or manual pin).')
      return
    }

    setIsLoading(true)
    setError(null)
    setSelectedIndex(null)
    try {
      const result = await getLoopRoute({
        data: { activity, start, durationMinutes },
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

        <label htmlFor="duration">Target duration (minutes)</label>
        <input
          id="duration"
          type="number"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
        />

        <fieldset>
          <legend>Start point</legend>
          <button type="button" onClick={useCurrentLocation}>
            Use current location
          </button>

          <label htmlFor="manual-lat">Latitude</label>
          <input
            id="manual-lat"
            type="number"
            value={manualLat}
            onChange={(event) => setManualLat(event.target.value)}
          />

          <label htmlFor="manual-lon">Longitude</label>
          <input
            id="manual-lon"
            type="number"
            value={manualLon}
            onChange={(event) => setManualLon(event.target.value)}
          />

          <button type="button" onClick={setPinManually}>
            Set pin manually
          </button>

          {start && (
            <p>
              Start point: {start.lat}, {start.lon}
            </p>
          )}
        </fieldset>

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
                  <dt>Ascent</dt>
                  <dd>{Math.round(candidate.metrics.ascentMeters)} m</dd>
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

      {selectedIndex !== null && start && candidates[selectedIndex] && (
        <section aria-label="Active route" data-testid="active-route">
          <h2>Active route: Candidate {selectedIndex + 1}</h2>
          <RouteMap
            start={[start.lat, start.lon]}
            coordinates={candidates[selectedIndex].coordinates}
          />
        </section>
      )}
    </main>
  )
}
