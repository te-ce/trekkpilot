import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('requests a loop route from the server function and renders it on the map', async () => {
    getLoopRouteMock.mockResolvedValue({
      coordinates: [
        [52.52, 13.405],
        [52.525, 13.41],
        [52.52, 13.405],
      ],
      distanceMeters: 15_000,
      durationSeconds: 3_600,
    })

    render(<Home />)

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
      expect(screen.getByTestId('route-map')).toBeInTheDocument(),
    )

    expect(getLoopRouteMock).toHaveBeenCalledWith({
      data: {
        activity: 'cycling',
        start: { lat: 52.52, lon: 13.405 },
        durationMinutes: 60,
      },
    })
    const map = screen.getByTestId('route-map')
    expect(JSON.parse(map.getAttribute('data-start') ?? '[]')).toEqual([
      52.52, 13.405,
    ])
    expect(JSON.parse(map.getAttribute('data-coordinates') ?? '[]')).toEqual([
      [52.52, 13.405],
      [52.525, 13.41],
      [52.52, 13.405],
    ])
  })
})
