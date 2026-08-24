import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-leaflet', () => ({
  MapContainer: (props: {
    children: React.ReactNode
    center: [number, number]
  }) => (
    <div data-testid="map-container" data-center={JSON.stringify(props.center)}>
      {props.children}
    </div>
  ),
  TileLayer: (props: { url: string }) => (
    <div data-testid="tile-layer" data-url={props.url} />
  ),
  Polyline: (props: { positions: [number, number][] }) => (
    <div
      data-testid="route-polyline"
      data-positions={JSON.stringify(props.positions)}
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
}))

import { RouteMap } from './RouteMap'

describe('RouteMap', () => {
  it('renders the route as a closed loop starting and ending at the chosen start point', () => {
    const start: [number, number] = [52.52, 13.405]
    const coordinates: [number, number][] = [
      [52.52, 13.405],
      [52.525, 13.41],
      [52.522, 13.415],
      [52.52, 13.405],
    ]

    render(<RouteMap start={start} coordinates={coordinates} />)

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-center',
      JSON.stringify(start),
    )
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain(
      'openstreetmap',
    )
    expect(screen.getByTestId('start-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify(start),
    )

    const positions = JSON.parse(
      screen.getByTestId('route-polyline').getAttribute('data-positions') ??
        '[]',
    )
    expect(positions).toEqual(coordinates)
    expect(positions[0]).toEqual(start)
    expect(positions.at(-1)).toEqual(start)
  })

  it('does not render a live position marker when no live position is given', () => {
    render(
      <RouteMap
        start={[52.52, 13.405]}
        coordinates={[
          [52.52, 13.405],
          [52.52, 13.405],
        ]}
      />,
    )

    expect(screen.queryByTestId('live-position-marker')).toBeNull()
  })

  it('renders the live position as a marker distinct from the start marker', () => {
    const start: [number, number] = [52.52, 13.405]
    const livePosition: [number, number] = [52.521, 13.406]

    render(
      <RouteMap
        start={start}
        coordinates={[start, start]}
        livePosition={livePosition}
      />,
    )

    expect(screen.getByTestId('live-position-marker')).toHaveAttribute(
      'data-center',
      JSON.stringify(livePosition),
    )
    // Still a separate marker from the route start.
    expect(screen.getByTestId('start-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify(start),
    )
  })
})
