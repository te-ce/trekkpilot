import 'leaflet/dist/leaflet.css'

import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
} from 'react-leaflet'

export type RouteMapProps = {
  /** Loop start/end point, as [lat, lon]. */
  start: [number, number]
  /** Ordered [lat, lon] pairs describing the closed loop; first and last should equal `start`. */
  coordinates: [number, number][]
  /**
   * The user's current live position, as [lat, lon] (issue 005). Rendered as
   * a blue dot distinct from the route's start marker. Omit while no live
   * position is available (e.g. tracking hasn't started yet).
   */
  livePosition?: [number, number]
}

export function RouteMap({ start, coordinates, livePosition }: RouteMapProps) {
  return (
    <MapContainer
      center={start}
      zoom={14}
      style={{ height: '400px', width: '100%' }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={start} />
      <Polyline positions={coordinates} />
      {livePosition && (
        <CircleMarker
          center={livePosition}
          radius={8}
          pathOptions={{
            color: '#1d4ed8',
            fillColor: '#3b82f6',
            fillOpacity: 1,
          }}
        />
      )}
    </MapContainer>
  )
}
