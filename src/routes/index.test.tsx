import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/components/RouteMap', () => ({
  RouteMap: (props: {
    start: [number, number]
    routes: { coordinates: [number, number][] }[]
    livePosition?: [number, number]
  }) => (
    <div
      data-testid="route-map"
      data-start={JSON.stringify(props.start)}
      data-coordinates={JSON.stringify(props.routes[0]?.coordinates)}
      data-live-position={JSON.stringify(props.livePosition ?? null)}
    />
  ),
}))

const getLoopRouteMock = vi.fn()
vi.mock('#/server/functions/getLoopRoute', () => ({
  getLoopRoute: (...args: unknown[]) => getLoopRouteMock(...args),
}))

const getPointToPointRouteMock = vi.fn()
vi.mock('#/server/functions/getPointToPointRoute', () => ({
  getPointToPointRoute: (...args: unknown[]) =>
    getPointToPointRouteMock(...args),
}))

const geocodeLocationMock = vi.fn()
vi.mock('#/server/functions/geocodeLocation', () => ({
  geocodeLocation: (...args: unknown[]) => geocodeLocationMock(...args),
}))

const downloadGpxMock = vi.fn()
vi.mock('#/lib/gpx', () => ({
  downloadGpx: (...args: unknown[]) => downloadGpxMock(...args),
}))

import { buildGoogleMapsUrl } from '#/lib/googleMaps'
import { getRouteHistory } from '#/lib/routeHistory'
import type { LoopRouteCandidate } from '#/server/ors'

import { Home } from './index'

describe('Home', () => {
  afterEach(() => {
    getLoopRouteMock.mockReset()
    getPointToPointRouteMock.mockReset()
    geocodeLocationMock.mockReset()
    downloadGpxMock.mockReset()
    localStorage.clear()
    // Restore the harmless default stub from test-setup.ts so tests that
    // don't care about geolocation (but may still activate live tracking by
    // selecting a route) aren't left with a previous test's mock.
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(() => 0),
        clearWatch: vi.fn(),
      },
      configurable: true,
    })
  })

  it('renders the welcome heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading')).toHaveTextContent('TrekkPilot')
  })

  it('lets the user pick which elevation metric drives scoring, defaulting to ascent', () => {
    render(<Home />)

    const select = screen.getByLabelText(/elevation metric/i)
    expect(select).toHaveValue('ascent')

    fireEvent.change(select, { target: { value: 'netChange' } })
    expect(select).toHaveValue('netChange')
  })

  it('lets the user pick an activity type and a target duration', () => {
    render(<Home />)

    expect(screen.getByLabelText(/activity/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/activity/i), {
      target: { value: 'trekking' },
    })
    expect(screen.getByLabelText(/activity/i)).toHaveValue('trekking')

    fireEvent.change(screen.getByLabelText(/duration/i), {
      target: { value: '45' },
    })
    expect(screen.getByLabelText(/duration/i)).toHaveValue(45)
  })

  it('lets the user drop a pin manually as the start point, without GPS', () => {
    render(<Home />)

    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set pin manually/i }))

    expect(screen.getByText(/52\.52.*13\.405/)).toBeInTheDocument()
  })

  it('reads the current GPS location as the start point when requested', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 48.2082, longitude: 16.3738 },
      } as GeolocationPosition)
    })
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    })

    render(<Home />)
    fireEvent.click(
      screen.getByRole('button', { name: /use current location/i }),
    )

    await waitFor(() =>
      expect(screen.getByText(/48\.2082.*16\.3738/)).toBeInTheDocument(),
    )
  })

  const sampleCandidates: LoopRouteCandidate[] = [
    {
      coordinates: [
        [52.52, 13.405],
        [52.525, 13.41],
        [52.52, 13.405],
      ],
      distanceMeters: 15_000,
      durationSeconds: 3_600,
      metrics: {
        ascentMeters: 120,
        turnCount: 8,
        pathTypeRatio: 0.6,
        constructionPenalty: 0,
      },
      score: 24,
    },
    {
      coordinates: [
        [52.52, 13.405],
        [52.53, 13.42],
        [52.52, 13.405],
      ],
      distanceMeters: 15_400,
      durationSeconds: 3_650,
      metrics: {
        ascentMeters: 200,
        turnCount: 12,
        pathTypeRatio: 0.2,
        constructionPenalty: 0.1,
      },
      score: 5,
    },
    {
      coordinates: [
        [52.52, 13.405],
        [52.518, 13.4],
        [52.52, 13.405],
      ],
      distanceMeters: 14_800,
      durationSeconds: 3_500,
      metrics: {
        ascentMeters: 60,
        turnCount: 6,
        pathTypeRatio: 0.4,
        constructionPenalty: 0,
      },
      score: 17,
    },
  ]

  async function fetchCandidates() {
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set pin manually/i }))

    fireEvent.change(screen.getByLabelText(/duration/i), {
      target: { value: '60' },
    })
    fireEvent.click(screen.getByRole('button', { name: /get route/i }))

    await waitFor(() =>
      expect(screen.getAllByTestId('route-map').length).toBeGreaterThan(0),
    )
  }

  it('requests loop route candidates from the server function', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    expect(getLoopRouteMock).toHaveBeenCalledWith({
      data: {
        activity: 'cycling',
        start: { lat: 52.52, lon: 13.405 },
        durationMinutes: 60,
        elevationMetric: 'ascent',
      },
    })
  })

  it('displays all 3 candidates with a map preview and their individual metric values', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    const maps = screen.getAllByTestId('route-map')
    expect(maps).toHaveLength(3)

    // Each candidate's own metrics should be visible, not just an opaque score.
    expect(screen.getByText(/120 m/)).toBeInTheDocument() // ascent of candidate 1
    expect(screen.getByText(/200 m/)).toBeInTheDocument() // ascent of candidate 2
    expect(screen.getByText(/60 m/)).toBeInTheDocument() // ascent of candidate 3
    expect(screen.getAllByText(/turn/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/construction/i).length).toBeGreaterThan(0)
  })

  it('shows the selected elevation metric value instead of ascent when a different metric is chosen', async () => {
    const candidatesWithAllMetrics = sampleCandidates.map((candidate) => ({
      ...candidate,
      metrics: {
        ...candidate.metrics,
        netElevationChangeMeters: candidate.metrics.ascentMeters / 4,
        maxGradientPercent: 8.5,
      },
    }))
    getLoopRouteMock.mockResolvedValue(candidatesWithAllMetrics)

    render(<Home />)
    fireEvent.change(screen.getByLabelText(/elevation metric/i), {
      target: { value: 'netChange' },
    })
    await fetchCandidates()

    expect(getLoopRouteMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ elevationMetric: 'netChange' }),
    })
    expect(screen.getAllByText(/net elevation change/i).length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText('30 m')).toBeInTheDocument() // 120 / 4
    expect(screen.getByText('50 m')).toBeInTheDocument() // 200 / 4
    expect(screen.getByText('15 m')).toBeInTheDocument() // 60 / 4
  })

  it('lets the user select one of the 3 candidates as the active route', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    const selectButtons = screen.getAllByRole('button', {
      name: /use this route/i,
    })
    expect(selectButtons).toHaveLength(3)

    const secondSelectButton = selectButtons[1]
    if (!secondSelectButton) {
      throw new Error('expected a second select button')
    }
    fireEvent.click(secondSelectButton)

    const activeSection = screen.getByTestId('active-route')
    expect(within(activeSection).getByText(/active route/i)).toBeInTheDocument()
    const activeMap = within(activeSection).getByTestId('route-map')
    expect(
      JSON.parse(activeMap.getAttribute('data-coordinates') ?? '[]'),
    ).toEqual(sampleCandidates[1]?.coordinates)
  })

  it('lets the user export the active route as a GPX file matching its exact coordinates', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    fireEvent.click(
      screen.getAllByRole('button', { name: /use this route/i })[1]!,
    )

    const activeSection = screen.getByTestId('active-route')
    fireEvent.click(
      within(activeSection).getByRole('button', { name: /export gpx/i }),
    )

    expect(downloadGpxMock).toHaveBeenCalledTimes(1)
    expect(downloadGpxMock).toHaveBeenCalledWith(
      { coordinates: sampleCandidates[1]?.coordinates },
      expect.stringMatching(/\.gpx$/),
    )
  })

  it('labels the GPX export as the exact route and offers a Google Maps link labeled as approximate', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    fireEvent.click(
      screen.getAllByRole('button', { name: /use this route/i })[1]!,
    )

    const activeSection = screen.getByTestId('active-route')
    expect(
      within(activeSection).getByText(/exact route \(gpx\)/i),
    ).toBeInTheDocument()
    expect(
      within(activeSection).getByText(/approximate \(google maps\)/i),
    ).toBeInTheDocument()

    const googleMapsLink = within(activeSection).getByRole('link', {
      name: /open in google maps/i,
    })
    expect(googleMapsLink).toHaveAttribute('target', '_blank')
    expect(googleMapsLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(googleMapsLink.getAttribute('href')).toBe(
      buildGoogleMapsUrl(
        sampleCandidates[1]!.coordinates as [number, number][],
      ),
    )
  })

  it('saves a record of the route to localStorage when the user selects it', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await fetchCandidates()

    fireEvent.click(
      screen.getAllByRole('button', { name: /use this route/i })[1]!,
    )

    const history = getRouteHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      activity: 'cycling',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[1],
    })
  })

  it('lists saved routes in a history view with activity, duration, date, and score', async () => {
    const { saveRouteToHistory } = await import('#/lib/routeHistory')
    saveRouteToHistory({
      activity: 'trekking',
      durationMinutes: 90,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[0]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    const historySection = screen.getByRole('region', { name: /history/i })
    expect(within(historySection).getByText(/trekking/i)).toBeInTheDocument()
    expect(within(historySection).getByText(/90/)).toBeInTheDocument()
    expect(within(historySection).getByText('24.0')).toBeInTheDocument()
  })

  it('lets the user reopen a saved history entry to view it as the active route', async () => {
    const { saveRouteToHistory } = await import('#/lib/routeHistory')
    saveRouteToHistory({
      activity: 'trekking',
      durationMinutes: 90,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[2]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    const historySection = screen.getByRole('region', { name: /history/i })
    fireEvent.click(
      within(historySection).getByRole('button', { name: /view/i }),
    )

    const activeSection = screen.getByTestId('active-route')
    const activeMap = within(activeSection).getByTestId('route-map')
    expect(
      JSON.parse(activeMap.getAttribute('data-coordinates') ?? '[]'),
    ).toEqual(sampleCandidates[2]?.coordinates)
  })

  it('lets the user re-export a reopened history entry as GPX', async () => {
    const { saveRouteToHistory } = await import('#/lib/routeHistory')
    saveRouteToHistory({
      activity: 'trekking',
      durationMinutes: 90,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[2]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    const historySection = screen.getByRole('region', { name: /history/i })
    fireEvent.click(
      within(historySection).getByRole('button', { name: /view/i }),
    )

    const activeSection = screen.getByTestId('active-route')
    fireEvent.click(
      within(activeSection).getByRole('button', { name: /export gpx/i }),
    )

    expect(downloadGpxMock).toHaveBeenCalledWith(
      { coordinates: sampleCandidates[2]?.coordinates },
      expect.stringMatching(/\.gpx$/),
    )
  })

  it('does not start live position tracking before a route is selected', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)
    const watchPosition = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch: vi.fn() },
      configurable: true,
    })

    render(<Home />)
    await fetchCandidates()

    expect(watchPosition).not.toHaveBeenCalled()
  })

  it('tracks and renders the live position on the active route once a route is selected', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)
    let successCallback: PositionCallback | undefined
    const watchPosition = vi.fn((success: PositionCallback) => {
      successCallback = success
      return 1
    })
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch: vi.fn() },
      configurable: true,
    })

    render(<Home />)
    await fetchCandidates()

    fireEvent.click(
      screen.getAllByRole('button', { name: /use this route/i })[0]!,
    )

    expect(watchPosition).toHaveBeenCalledTimes(1)

    successCallback?.({
      coords: { latitude: 52.523, longitude: 13.407 },
    } as GeolocationPosition)

    const activeSection = screen.getByTestId('active-route')
    await waitFor(() =>
      expect(within(activeSection).getByTestId('route-map')).toHaveAttribute(
        'data-live-position',
        JSON.stringify([52.523, 13.407]),
      ),
    )
  })

  it('defaults to loop mode with the duration field visible and no stop point section', () => {
    render(<Home />)

    expect(screen.getByLabelText(/mode/i)).toHaveValue('loop')
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /stop point/i })).toBeNull()
  })

  it('switches to point-to-point mode, hiding duration and showing a stop point section', () => {
    render(<Home />)

    fireEvent.change(screen.getByLabelText(/mode/i), {
      target: { value: 'pointToPoint' },
    })

    expect(screen.queryByLabelText(/duration/i)).toBeNull()
    expect(
      screen.getByRole('group', { name: /stop point/i }),
    ).toBeInTheDocument()
  })

  it('lets the user set a stop point manually via lat/lon in point-to-point mode', () => {
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/mode/i), {
      target: { value: 'pointToPoint' },
    })

    const stopSection = screen.getByRole('group', { name: /stop point/i })
    fireEvent.change(within(stopSection).getByLabelText(/latitude/i), {
      target: { value: '52.53' },
    })
    fireEvent.change(within(stopSection).getByLabelText(/longitude/i), {
      target: { value: '13.42' },
    })
    fireEvent.click(
      within(stopSection).getByRole('button', { name: /set pin manually/i }),
    )

    expect(screen.getByText(/52\.53.*13\.42/)).toBeInTheDocument()
  })

  it('lets the user search for a start location by name', async () => {
    geocodeLocationMock.mockResolvedValue({
      lat: 52.52,
      lon: 13.405,
      label: 'Berlin, Germany',
    })
    render(<Home />)

    const startSection = screen.getByRole('group', { name: /start point/i })
    fireEvent.change(within(startSection).getByLabelText(/search location/i), {
      target: { value: 'Berlin' },
    })
    fireEvent.click(
      within(startSection).getByRole('button', { name: /search/i }),
    )

    expect(geocodeLocationMock).toHaveBeenCalledWith({
      data: { query: 'Berlin' },
    })
    await waitFor(() =>
      expect(screen.getByText(/52\.52.*13\.405/)).toBeInTheDocument(),
    )
  })

  it('lets the user search for a stop location by name in point-to-point mode', async () => {
    geocodeLocationMock.mockResolvedValue({
      lat: 52.53,
      lon: 13.42,
      label: 'Berlin Hauptbahnhof',
    })
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/mode/i), {
      target: { value: 'pointToPoint' },
    })

    const stopSection = screen.getByRole('group', { name: /stop point/i })
    fireEvent.change(within(stopSection).getByLabelText(/search location/i), {
      target: { value: 'Berlin Hauptbahnhof' },
    })
    fireEvent.click(
      within(stopSection).getByRole('button', { name: /search/i }),
    )

    expect(geocodeLocationMock).toHaveBeenCalledWith({
      data: { query: 'Berlin Hauptbahnhof' },
    })
    await waitFor(() =>
      expect(screen.getByText(/52\.53.*13\.42/)).toBeInTheDocument(),
    )
  })

  async function fetchPointToPointCandidates() {
    const startSection = screen.getByRole('group', { name: /start point/i })
    fireEvent.change(within(startSection).getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(within(startSection).getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(
      within(startSection).getByRole('button', { name: /set pin manually/i }),
    )

    const stopSection = screen.getByRole('group', { name: /stop point/i })
    fireEvent.change(within(stopSection).getByLabelText(/latitude/i), {
      target: { value: '52.53' },
    })
    fireEvent.change(within(stopSection).getByLabelText(/longitude/i), {
      target: { value: '13.42' },
    })
    fireEvent.click(
      within(stopSection).getByRole('button', { name: /set pin manually/i }),
    )

    fireEvent.click(screen.getByRole('button', { name: /get route/i }))

    await waitFor(() =>
      expect(screen.getAllByTestId('route-map').length).toBeGreaterThan(0),
    )
  }

  it('requests point-to-point route candidates from the server function in point-to-point mode', async () => {
    getPointToPointRouteMock.mockResolvedValue(sampleCandidates)
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/mode/i), {
      target: { value: 'pointToPoint' },
    })

    await fetchPointToPointCandidates()

    expect(getPointToPointRouteMock).toHaveBeenCalledWith({
      data: {
        activity: 'cycling',
        start: { lat: 52.52, lon: 13.405 },
        stop: { lat: 52.53, lon: 13.42 },
        elevationMetric: 'ascent',
      },
    })
    expect(getLoopRouteMock).not.toHaveBeenCalled()
  })

  it('displays point-to-point candidates the same way as loop candidates', async () => {
    getPointToPointRouteMock.mockResolvedValue(sampleCandidates)
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/mode/i), {
      target: { value: 'pointToPoint' },
    })

    await fetchPointToPointCandidates()

    expect(screen.getAllByTestId('route-map')).toHaveLength(3)
    expect(
      screen.getAllByRole('button', { name: /use this route/i }),
    ).toHaveLength(3)
  })
})
