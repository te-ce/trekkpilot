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
    coordinates: [number, number][]
  }) => (
    <div
      data-testid="route-map"
      data-start={JSON.stringify(props.start)}
      data-coordinates={JSON.stringify(props.coordinates)}
    />
  ),
}))

const getLoopRouteMock = vi.fn()
vi.mock('#/server/functions/getLoopRoute', () => ({
  getLoopRoute: (...args: unknown[]) => getLoopRouteMock(...args),
}))

import { Home } from './index'

describe('Home', () => {
  afterEach(() => {
    getLoopRouteMock.mockReset()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: undefined,
      configurable: true,
    })
  })

  it('renders the welcome heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading')).toHaveTextContent('TrekkPilot')
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

  const sampleCandidates = [
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
})
