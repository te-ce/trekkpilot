import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The Leaflet map handle the component drives imperatively. */
const map = vi.hoisted(() => ({ setView: vi.fn(), fitBounds: vi.fn() }))

/** Captures the handlers the component registers via `useMapEvents`. */
const mapEvents = vi.hoisted(() => ({
  handlers: null as null | {
    click?: (event: { latlng: { lat: number; lng: number } }) => void
  },
}))

vi.mock('react-leaflet', () => ({
  MapContainer: (props: {
    children: React.ReactNode
    center: [number, number]
    className?: string
  }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(props.center)}
      className={props.className}
    >
      {props.children}
    </div>
  ),
  TileLayer: (props: { url: string; attribution: string }) => (
    <div
      data-testid="tile-layer"
      data-url={props.url}
      data-attribution={props.attribution}
    />
  ),
  Polyline: (props: {
    positions: [number, number][]
    pathOptions?: { color?: string; weight?: number; opacity?: number }
  }) => (
    <div
      data-testid="route-polyline"
      data-positions={JSON.stringify(props.positions)}
      data-color={props.pathOptions?.color}
      data-weight={props.pathOptions?.weight}
      data-opacity={props.pathOptions?.opacity}
    />
  ),
  Marker: (props: { position: [number, number] }) => (
    <div
      data-testid="start-marker"
      data-position={JSON.stringify(props.position)}
    />
  ),
  CircleMarker: (props: { center: [number, number] }) => (
    <div
      data-testid="live-position-marker"
      data-center={JSON.stringify(props.center)}
    />
  ),
  useMap: () => map,
  useMapEvents: (handlers: {
    click?: (event: { latlng: { lat: number; lng: number } }) => void
  }) => {
    mapEvents.handlers = handlers
    return map
  },
}))

import { RouteMap, type RoutePolyline } from './RouteMap'

const START: [number, number] = [52.52, 13.405]

function route(overrides: Partial<RoutePolyline> = {}): RoutePolyline {
  return {
    id: 'candidate-0',
    coordinates: [START, [52.525, 13.41], START],
    color: '#0B6E4F',
    isActive: false,
    ...overrides,
  }
}

describe('RouteMap', () => {
  it('renders one OSM-tiled map for all routes at once', () => {
    render(
      <RouteMap
        start={START}
        routes={[
          route({ id: 'candidate-0', isActive: true }),
          route({ id: 'candidate-1', color: '#2F6690' }),
          route({ id: 'candidate-2', color: '#A9700F' }),
        ]}
      />,
    )

    expect(screen.getAllByTestId('map-container')).toHaveLength(1)
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain(
      'openstreetmap',
    )
    expect(
      screen.getByTestId('tile-layer').getAttribute('data-attribution'),
    ).toContain('OpenStreetMap')
    expect(screen.getAllByTestId('route-polyline')).toHaveLength(3)
  })

  it('draws each route in its own color, with its own coordinates', () => {
    const first: [number, number][] = [START, [52.53, 13.42], START]
    const second: [number, number][] = [START, [52.51, 13.39], START]

    render(
      <RouteMap
        start={START}
        routes={[
          route({ id: 'candidate-0', coordinates: first, color: '#0B6E4F' }),
          route({ id: 'candidate-1', coordinates: second, color: '#2F6690' }),
        ]}
      />,
    )

    const polylines = screen.getAllByTestId('route-polyline')
    const byColor = new Map(
      polylines.map((element) => [
        element.getAttribute('data-color'),
        JSON.parse(element.getAttribute('data-positions') ?? '[]'),
      ]),
    )
    expect(byColor.get('#0B6E4F')).toEqual(first)
    expect(byColor.get('#2F6690')).toEqual(second)
  })

  it('draws the active route thick and opaque, above the dimmed inactive ones', () => {
    render(
      <RouteMap
        start={START}
        routes={[
          route({ id: 'candidate-0', color: '#0B6E4F' }),
          route({ id: 'candidate-1', color: '#2F6690', isActive: true }),
          route({ id: 'candidate-2', color: '#A9700F' }),
        ]}
      />,
    )

    const polylines = screen.getAllByTestId('route-polyline')
    const last = polylines.at(-1)

    // The active route paints last, so it sits above the others.
    expect(last?.getAttribute('data-color')).toBe('#2F6690')
    expect(Number(last?.getAttribute('data-weight'))).toBeGreaterThan(4)
    expect(Number(last?.getAttribute('data-opacity'))).toBe(1)

    for (const inactive of polylines.slice(0, -1)) {
      expect(Number(inactive.getAttribute('data-weight'))).toBeLessThan(
        Number(last?.getAttribute('data-weight')),
      )
      expect(Number(inactive.getAttribute('data-opacity'))).toBeLessThan(1)
    }
  })

  it('renders no polylines when there are no routes yet', () => {
    render(<RouteMap start={START} routes={[]} />)

    expect(screen.queryAllByTestId('route-polyline')).toHaveLength(0)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders a start marker only once a start point is chosen', () => {
    const { unmount } = render(<RouteMap start={null} routes={[]} />)
    expect(screen.queryByTestId('start-marker')).toBeNull()
    unmount()

    render(<RouteMap start={START} routes={[]} />)
    expect(screen.getByTestId('start-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify(START),
    )
  })

  it('does not render a live position marker when no live position is given', () => {
    render(<RouteMap start={START} routes={[route()]} />)

    expect(screen.queryByTestId('live-position-marker')).toBeNull()
  })

  it('renders the live position as a marker distinct from the start marker', () => {
    const livePosition: [number, number] = [52.521, 13.406]

    render(
      <RouteMap start={START} routes={[route()]} livePosition={livePosition} />,
    )

    expect(screen.getByTestId('live-position-marker')).toHaveAttribute(
      'data-center',
      JSON.stringify(livePosition),
    )
    expect(screen.getByTestId('start-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify(START),
    )
  })

  it('lets the caller size the map via className', () => {
    render(<RouteMap start={START} routes={[]} className="h-64" />)

    expect(screen.getByTestId('map-container')).toHaveClass('h-64')
  })
})

describe('RouteMap interactions', () => {
  beforeEach(() => {
    map.setView.mockClear()
    map.fitBounds.mockClear()
    mapEvents.handlers = null
  })

  it('reports map taps as a { lat, lon } point for drop-a-pin start selection', () => {
    const onMapClick = vi.fn()

    render(<RouteMap start={null} routes={[]} onMapClick={onMapClick} />)

    mapEvents.handlers?.click?.({ latlng: { lat: 52.5, lng: 13.4 } })

    expect(onMapClick).toHaveBeenCalledWith({ lat: 52.5, lon: 13.4 })
  })

  it('does not listen for map taps when no handler is given', () => {
    render(<RouteMap start={START} routes={[]} />)

    expect(mapEvents.handlers).toBeNull()
  })

  it('recenters on the live position while following', () => {
    const { rerender } = render(
      <RouteMap
        start={START}
        routes={[]}
        follow
        livePosition={[52.52, 13.405]}
      />,
    )
    map.setView.mockClear()

    rerender(
      <RouteMap
        start={START}
        routes={[]}
        follow
        livePosition={[52.53, 13.42]}
      />,
    )

    expect(map.setView).toHaveBeenCalledWith([52.53, 13.42])
  })

  it('leaves the viewport alone when following is off', () => {
    const { rerender } = render(
      <RouteMap start={START} routes={[]} livePosition={[52.52, 13.405]} />,
    )

    rerender(
      <RouteMap start={START} routes={[]} livePosition={[52.53, 13.42]} />,
    )

    expect(map.setView).not.toHaveBeenCalled()
  })

  it('fits the viewport to every drawn route so all loops are visible', () => {
    const first: [number, number][] = [START, [52.53, 13.42]]
    const second: [number, number][] = [START, [52.51, 13.39]]

    render(
      <RouteMap
        start={START}
        routes={[
          route({ id: 'candidate-0', coordinates: first }),
          route({ id: 'candidate-1', coordinates: second }),
        ]}
      />,
    )

    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(map.fitBounds.mock.calls[0]?.[0]).toEqual([...first, ...second])
  })

  it('refits when the drawn routes change', () => {
    const { rerender } = render(
      <RouteMap start={START} routes={[route({ id: 'candidate-0' })]} />,
    )
    map.fitBounds.mockClear()

    rerender(<RouteMap start={START} routes={[route({ id: 'candidate-1' })]} />)

    expect(map.fitBounds).toHaveBeenCalledTimes(1)
  })

  it('does not try to fit an empty route set', () => {
    render(<RouteMap start={START} routes={[]} />)

    expect(map.fitBounds).not.toHaveBeenCalled()
  })
})

describe('RouteMap refitting', () => {
  beforeEach(() => {
    map.fitBounds.mockClear()
  })

  it('refits when a fresh search reuses the same route ids with new geometry', () => {
    const { rerender } = render(
      <RouteMap
        start={START}
        routes={[
          route({ id: 'candidate-0', coordinates: [START, [52.6, 13.5]] }),
        ]}
      />,
    )
    map.fitBounds.mockClear()

    rerender(
      <RouteMap
        start={START}
        routes={[
          route({
            id: 'candidate-0',
            coordinates: [
              [48.1, 11.6],
              [48.2, 11.7],
            ],
          }),
        ]}
      />,
    )

    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(map.fitBounds.mock.calls[0]?.[0]).toEqual([
      [48.1, 11.6],
      [48.2, 11.7],
    ])
  })
})
