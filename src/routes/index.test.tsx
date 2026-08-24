import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Where the fake map reports a tap, so tap-to-drop-a-pin is assertable. */
const MAP_TAP_POINT = { lat: 48.2082, lon: 16.3738 }

// The page renders the map through MapCanvas, which client-only-loads the real
// Leaflet component; this stands in for that whole boundary.
vi.mock('#/components/MapCanvas', () => ({
  MapCanvas: (props: {
    start: [number, number] | null
    routes: {
      id: string
      coordinates: [number, number][]
      color: string
      isActive: boolean
    }[]
    livePosition?: [number, number]
    follow?: boolean
    jumpTo?: { position: [number, number]; token: number }
    onFollowCancel?: () => void
    onMapClick?: (point: { lat: number; lon: number }) => void
  }) => (
    <div
      data-testid="route-map"
      data-start={JSON.stringify(props.start)}
      data-routes={JSON.stringify(props.routes)}
      data-live-position={JSON.stringify(props.livePosition ?? null)}
      data-follow={String(props.follow ?? false)}
      data-jump-to={JSON.stringify(props.jumpTo ?? null)}
    >
      <button type="button" onClick={() => props.onMapClick?.(MAP_TAP_POINT)}>
        tap the map
      </button>
      {/* Stands in for a real drag gesture on the Leaflet map. */}
      <button type="button" onClick={() => props.onFollowCancel?.()}>
        drag the map
      </button>
    </div>
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
import { ROUTE_COLORS } from '#/lib/ranking'
import {
  formatHistoryDate,
  getRouteHistory,
  saveRouteToHistory,
} from '#/lib/routeHistory'
import type { LoopRouteCandidate } from '#/server/ors'

import { Home } from './index'

/** The routes the (mocked) map was asked to draw. */
function drawnRoutes(): {
  id: string
  coordinates: [number, number][]
  color: string
  isActive: boolean
}[] {
  return JSON.parse(
    screen.getByTestId('route-map').getAttribute('data-routes') ?? '[]',
  )
}

function tapMap() {
  fireEvent.click(screen.getByRole('button', { name: /tap the map/i }))
}

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

  it('names the app in a top-level heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'TrekkPilot',
    )
  })

  it('opens on the plan, with the map behind it', () => {
    render(<Home />)

    expect(screen.getByTestId('route-map')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /loop/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /cycling/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: '1 h' })).toBeChecked()
  })

  it('shows the target distance the chosen duration works out to', () => {
    render(<Home />)

    expect(screen.getByText(/≈ 15\.0 km at 15 km\/h/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: '1 h 30' }))
    expect(screen.getByText(/≈ 22\.5 km at 15 km\/h/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /trekking/i }))
    expect(screen.getByText(/≈ 6\.8 km at 4\.5 km\/h/)).toBeInTheDocument()
  })

  it('summarises the plan in a pill that reopens the plan editor', () => {
    render(<Home />)

    expect(
      screen.getByRole('button', { name: /cycling · 1 h/i }),
    ).toBeInTheDocument()
  })

  it('drops the start pin where the user taps the map', () => {
    render(<Home />)
    expect(
      screen.getByRole('button', { name: /set a start point/i }),
    ).toBeInTheDocument()

    tapMap()

    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-start',
      JSON.stringify([MAP_TAP_POINT.lat, MAP_TAP_POINT.lon]),
    )
    expect(
      screen.getAllByRole('button', { name: /48\.208, 16\.374/ }).length,
    ).toBeGreaterThan(0)
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
      screen.getByRole('button', { name: /use my current location/i }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute(
        'data-start',
        JSON.stringify([48.2082, 16.3738]),
      ),
    )
  })

  it('searches for a start location by name and shows the place it found', async () => {
    geocodeLocationMock.mockResolvedValue({
      lat: 52.52,
      lon: 13.405,
      label: 'Berlin, Germany',
    })
    render(<Home />)

    const startGroup = screen.getByRole('group', { name: /start point/i })
    fireEvent.change(within(startGroup).getByLabelText(/search for a place/i), {
      target: { value: 'Berlin' },
    })
    fireEvent.click(within(startGroup).getByRole('button', { name: /search/i }))

    expect(geocodeLocationMock).toHaveBeenCalledWith({
      data: { query: 'Berlin' },
    })
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /berlin, germany/i }).length,
      ).toBeGreaterThan(0),
    )
  })

  it('keeps a manual lat/lon override for the start point, one level down', () => {
    render(<Home />)

    const startGroup = screen.getByRole('group', { name: /start point/i })
    fireEvent.change(within(startGroup).getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(within(startGroup).getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(
      within(startGroup).getByRole('button', {
        name: /use these coordinates/i,
      }),
    )

    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-start',
      JSON.stringify([52.52, 13.405]),
    )
  })

  it('asks for a stop point instead of a duration in point-to-point mode', () => {
    render(<Home />)
    expect(screen.queryByRole('group', { name: /stop point/i })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /a→b/i }))

    expect(
      screen.getByRole('group', { name: /stop point/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '1 h' })).toBeNull()
  })

  it('starts with no routes drawn on the map', () => {
    render(<Home />)
    expect(drawnRoutes()).toEqual([])
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
        netElevationChangeMeters: 30,
        maxGradientPercent: 6,
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
        netElevationChangeMeters: 50,
        maxGradientPercent: 11,
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
        netElevationChangeMeters: 15,
        maxGradientPercent: 4,
        turnCount: 6,
        pathTypeRatio: 0.4,
        constructionPenalty: 0,
      },
      score: 17,
    },
  ]

  /** Sets a start point and runs the search, resolving into the results state. */
  async function findRoutes() {
    tapMap()
    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))
    await waitFor(() =>
      expect(screen.getAllByTestId('candidate-row').length).toBe(3),
    )
  }

  it('asks the server for loop candidates matching the plan', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    expect(getLoopRouteMock).toHaveBeenCalledWith({
      data: {
        activity: 'cycling',
        start: MAP_TAP_POINT,
        durationMinutes: 60,
        elevationMetric: 'ascent',
      },
    })
  })

  it('says what it is doing while the five route options are being fetched', async () => {
    let resolveRoutes: (value: LoopRouteCandidate[]) => void = () => undefined
    getLoopRouteMock.mockReturnValue(
      new Promise<LoopRouteCandidate[]>((resolve) => {
        resolveRoutes = resolve
      }),
    )

    render(<Home />)
    tapMap()
    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))

    expect(screen.getByText(/5 route options/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0)

    resolveRoutes(sampleCandidates)
    await waitFor(() =>
      expect(screen.getAllByTestId('candidate-row').length).toBe(3),
    )
  })

  it('draws all three candidates on the one map, each in its own colour', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    expect(drawnRoutes().map((route) => route.coordinates)).toEqual(
      sampleCandidates.map((candidate) => candidate.coordinates),
    )
    expect(drawnRoutes().map((route) => route.color)).toEqual([...ROUTE_COLORS])
    expect(drawnRoutes().every((route) => !route.isActive)).toBe(true)
  })

  it('leads each row with the distance and the time it takes', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    expect(screen.getByText(/3 loops from here/i)).toBeInTheDocument()
    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]).toHaveTextContent('15.0 km')
    expect(rows[0]).toHaveTextContent('1 h 0 min')
    expect(rows[1]).toHaveTextContent('14.8 km')
    expect(rows[2]).toHaveTextContent('15.4 km')
  })

  it('shows each row its rank, its reason, and its own metric values', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]).toHaveTextContent('#1')
    expect(rows[0]).toHaveTextContent(/most bike path/i)
    expect(rows[0]).toHaveTextContent('120 m')
    expect(rows[0]).toHaveTextContent(/8 turns/)
    expect(rows[0]).toHaveTextContent('60%')
    expect(rows[1]).toHaveTextContent('60 m')
    expect(rows[1]).toHaveTextContent(/flattest/i)
    expect(rows[2]).toHaveTextContent('200 m')
    expect(rows[2]).toHaveTextContent(/roadworks/i)
  })

  it('gives each row a swatch matching the colour of its line on the map', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    const swatches = screen
      .getAllByTestId('candidate-row')
      .map((row) => within(row).getByTestId('route-swatch'))
    expect(swatches[0]).toHaveStyle({ backgroundColor: 'rgb(11, 110, 79)' })
    // Row 2 is the third candidate under the default ranking, and keeps the
    // third colour.
    expect(swatches[1]).toHaveStyle({ backgroundColor: 'rgb(169, 112, 15)' })
  })

  it('re-ranks the same three routes without asking the server again', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    fireEvent.change(screen.getByLabelText(/rank by/i), {
      target: { value: 'flat' },
    })

    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]).toHaveTextContent('14.8 km')
    expect(rows[0]).toHaveTextContent('#1')
    expect(rows[2]).toHaveTextContent('15.4 km')
    expect(getLoopRouteMock).toHaveBeenCalledTimes(1)
    // A route keeps its colour when the ranking changes, so rows and lines
    // still match up.
    expect(within(rows[0]!).getByTestId('route-swatch')).toHaveStyle({
      backgroundColor: 'rgb(169, 112, 15)',
    })
  })

  it('lets the user choose which elevation metric the rows show and rank by, defaulting to ascent', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    const metric = screen.getByLabelText(/elevation metric/i)
    expect(metric).toHaveValue('ascent')
    expect(screen.getAllByText(/total ascent/i).length).toBeGreaterThan(0)

    fireEvent.change(metric, { target: { value: 'netChange' } })

    expect(screen.getAllByText(/net elevation change/i).length).toBeGreaterThan(
      0,
    )
    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]).toHaveTextContent('30 m')
    expect(rows[1]).toHaveTextContent('15 m')
    expect(rows[2]).toHaveTextContent('50 m')
  })

  it('sends the chosen elevation metric to the server on the next search', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()

    fireEvent.change(screen.getByLabelText(/elevation metric/i), {
      target: { value: 'maxGradient' },
    })
    fireEvent.click(screen.getByRole('button', { name: /cycling · 1 h/i }))
    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))

    await waitFor(() =>
      expect(getLoopRouteMock).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ elevationMetric: 'maxGradient' }),
      }),
    )
  })

  it('asks the server for a point-to-point route when a stop point is set', async () => {
    getPointToPointRouteMock.mockResolvedValue(sampleCandidates)
    render(<Home />)

    fireEvent.click(screen.getByRole('radio', { name: /a→b/i }))
    tapMap()

    const stopGroup = screen.getByRole('group', { name: /stop point/i })
    fireEvent.change(within(stopGroup).getByLabelText(/latitude/i), {
      target: { value: '52.53' },
    })
    fireEvent.change(within(stopGroup).getByLabelText(/longitude/i), {
      target: { value: '13.42' },
    })
    fireEvent.click(
      within(stopGroup).getByRole('button', { name: /use these coordinates/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))

    await waitFor(() =>
      expect(screen.getAllByTestId('candidate-row').length).toBe(3),
    )
    expect(getPointToPointRouteMock).toHaveBeenCalledWith({
      data: {
        activity: 'cycling',
        start: MAP_TAP_POINT,
        stop: { lat: 52.53, lon: 13.42 },
        elevationMetric: 'ascent',
      },
    })
    expect(getLoopRouteMock).not.toHaveBeenCalled()
    expect(screen.getByText(/3 routes to your stop/i)).toBeInTheDocument()
  })

  it('refuses to search without a start point, and says so', () => {
    render(<Home />)

    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/start point/i)
    expect(getLoopRouteMock).not.toHaveBeenCalled()
  })

  /** Picks the nth row (0-based) of the current ranking as the active route. */
  function selectRow(index: number) {
    fireEvent.click(screen.getAllByTestId('candidate-row')[index]!)
  }

  it('makes a tapped row the active route, thicker and on top on the map', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()
    // Row 2 under the default ranking is the third fetched candidate.
    selectRow(1)

    expect(drawnRoutes().map((route) => route.isActive)).toEqual([
      false,
      false,
      true,
    ])
    expect(
      screen.getByRole('button', { name: /start this loop/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('14.8 km')).toBeInTheDocument()
  })

  it('leads back to the list from the active route', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()
    selectRow(0)
    expect(screen.queryAllByTestId('candidate-row')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /all routes/i }))

    expect(screen.getAllByTestId('candidate-row')).toHaveLength(3)
  })

  it('exports the active route as GPX with its exact geometry', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()
    selectRow(1)

    fireEvent.click(screen.getByRole('button', { name: /download gpx/i }))

    expect(downloadGpxMock).toHaveBeenCalledTimes(1)
    expect(downloadGpxMock).toHaveBeenCalledWith(
      { coordinates: sampleCandidates[2]?.coordinates },
      expect.stringMatching(/\.gpx$/),
    )
    expect(screen.getByText(/exact geometry/i)).toBeInTheDocument()
  })

  it('offers a Google Maps link, with its approximation caveat on the link itself', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()
    selectRow(1)

    const link = screen.getByRole('link', { name: /open in google maps/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.getAttribute('href')).toBe(
      buildGoogleMapsUrl(sampleCandidates[2]!.coordinates),
    )

    const caveat = screen.getByTestId('google-maps-caveat')
    expect(caveat).toHaveTextContent(/approximate/i)
    expect(caveat).toHaveTextContent(/9 waypoints/i)
  })

  it('saves the picked route to history as soon as it is picked', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    await findRoutes()
    selectRow(1)

    const history = getRouteHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      activity: 'cycling',
      durationMinutes: 60,
      start: MAP_TAP_POINT,
      candidate: sampleCandidates[2],
    })
  })

  it('does not track the live position before a route is picked', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)
    const watchPosition = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch: vi.fn() },
      configurable: true,
    })

    render(<Home />)
    await findRoutes()

    expect(watchPosition).not.toHaveBeenCalled()
  })

  it('shows the live position on the map once a route is picked', async () => {
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
    await findRoutes()
    selectRow(0)

    expect(watchPosition).toHaveBeenCalledTimes(1)
    successCallback?.({
      coords: { latitude: 52.523, longitude: 13.407 },
    } as GeolocationPosition)

    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute(
        'data-live-position',
        JSON.stringify([52.523, 13.407]),
      ),
    )
  })

  it('follows the live position when the walk starts, and lets the map control turn it off', async () => {
    getLoopRouteMock.mockResolvedValue(sampleCandidates)

    render(<Home />)
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'false',
    )
    await findRoutes()
    selectRow(0)

    fireEvent.click(screen.getByRole('button', { name: /start this loop/i }))
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'true',
    )
    expect(
      screen.getByRole('button', { name: /follow my position/i }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /follow my position/i }))
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'false',
    )
  })

  /** Stubs geolocation so both the one-shot read and the watch resolve. */
  function stubGeolocationAt(lat: number, lon: number) {
    const coords = { latitude: lat, longitude: lon } as GeolocationCoordinates
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords } as GeolocationPosition)
    })
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({ coords } as GeolocationPosition)
      return 1
    })
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition, watchPosition, clearWatch: vi.fn() },
      configurable: true,
    })
    return { getCurrentPosition, watchPosition }
  }

  it('centres the map on the current position on demand, with no route and no start point', async () => {
    stubGeolocationAt(48.2082, 16.3738)

    render(<Home />)
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-jump-to',
      'null',
    )

    fireEvent.click(
      screen.getByRole('button', { name: /centre the map on my location/i }),
    )

    await waitFor(() =>
      expect(
        JSON.parse(
          screen.getByTestId('route-map').getAttribute('data-jump-to') ??
            'null',
        ),
      ).toMatchObject({ position: [48.2082, 16.3738] }),
    )
    // Centring must not silently adopt the position as the start point.
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-start',
      'null',
    )
  })

  it('asks again on a second tap, so it still recentres after a pan', async () => {
    stubGeolocationAt(48.2082, 16.3738)

    render(<Home />)
    const centre = screen.getByRole('button', {
      name: /centre the map on my location/i,
    })
    fireEvent.click(centre)
    await waitFor(() =>
      expect(screen.getByTestId('route-map')).not.toHaveAttribute(
        'data-jump-to',
        'null',
      ),
    )
    const first = screen.getByTestId('route-map').getAttribute('data-jump-to')

    fireEvent.click(centre)

    await waitFor(() =>
      expect(
        screen.getByTestId('route-map').getAttribute('data-jump-to'),
      ).not.toBe(first),
    )
  })

  it('shows the live position dot once the map has been centred on it', async () => {
    stubGeolocationAt(48.2082, 16.3738)

    render(<Home />)
    fireEvent.click(
      screen.getByRole('button', { name: /centre the map on my location/i }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute(
        'data-live-position',
        JSON.stringify([48.2082, 16.3738]),
      ),
    )
  })

  it('reports a refused or unavailable position instead of doing nothing', () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(
          (_success: PositionCallback, failure?: PositionErrorCallback) => {
            failure?.({ code: 1 } as GeolocationPositionError)
          },
        ),
        watchPosition: vi.fn(() => 1),
        clearWatch: vi.fn(),
      },
      configurable: true,
    })

    render(<Home />)
    fireEvent.click(
      screen.getByRole('button', { name: /centre the map on my location/i }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/location/i)
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-jump-to',
      'null',
    )
  })

  it('tracks and follows the live position from the pill bar, with no route picked', async () => {
    const { watchPosition } = stubGeolocationAt(48.2082, 16.3738)

    render(<Home />)
    expect(watchPosition).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /follow my position/i }))

    expect(watchPosition).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: /follow my position/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(screen.getByTestId('route-map')).toHaveAttribute(
        'data-live-position',
        JSON.stringify([48.2082, 16.3738]),
      ),
    )
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'true',
    )
  })

  it('stops following when the user drags the map', () => {
    stubGeolocationAt(48.2082, 16.3738)

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /follow my position/i }))
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /drag the map/i }))

    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-follow',
      'false',
    )
    expect(
      screen.getByRole('button', { name: /follow my position/i }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('says so when there is no history yet', () => {
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    expect(screen.getByText(/no saved routes yet/i)).toBeInTheDocument()
  })

  it('lists saved routes with their distance and when they were saved', () => {
    saveRouteToHistory({
      activity: 'trekking',
      mode: 'loop',
      durationMinutes: 90,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[0]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    const entry = screen.getByTestId('history-entry')
    expect(entry).toHaveTextContent('15.0 km')
    expect(entry).toHaveTextContent(/trekking/i)
    expect(entry).toHaveTextContent('1 h 30')
    expect(entry).toHaveTextContent(
      formatHistoryDate(getRouteHistory()[0]!.timestamp),
    )
  })

  it('leaves the duration off a saved point-to-point route, where it means nothing', () => {
    saveRouteToHistory({
      activity: 'cycling',
      mode: 'pointToPoint',
      durationMinutes: 60,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[0]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))

    const entry = screen.getByTestId('history-entry')
    expect(entry).toHaveTextContent('15.0 km')
    expect(entry).not.toHaveTextContent('1 h 0')
    expect(entry).toHaveTextContent(/a→b/i)
  })

  it('reopens a saved route as the active route, exports included', () => {
    saveRouteToHistory({
      activity: 'trekking',
      mode: 'loop',
      durationMinutes: 90,
      start: { lat: 52.52, lon: 13.405 },
      candidate: sampleCandidates[2]!,
    })

    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: /history/i }))
    fireEvent.click(screen.getByTestId('history-entry'))

    expect(drawnRoutes()).toEqual([
      {
        id: 'history-route',
        coordinates: sampleCandidates[2]?.coordinates,
        color: ROUTE_COLORS[0],
        isActive: true,
      },
    ])
    expect(screen.getByTestId('route-map')).toHaveAttribute(
      'data-start',
      JSON.stringify([52.52, 13.405]),
    )

    fireEvent.click(screen.getByRole('button', { name: /download gpx/i }))
    expect(downloadGpxMock).toHaveBeenCalledWith(
      { coordinates: sampleCandidates[2]?.coordinates },
      expect.stringMatching(/\.gpx$/),
    )
  })

  it('reports a failed search instead of leaving an empty sheet', async () => {
    getLoopRouteMock.mockRejectedValue(new Error('ORS is down'))

    render(<Home />)
    tapMap()
    fireEvent.click(screen.getByRole('button', { name: /find 3 routes/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not/i),
    )
  })
})
