import 'leaflet/dist/leaflet.css'

import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'

export type RouteMapProps = {
  /** Loop start/end point, as [lat, lon]. */
  start: [number, number]
  /** Ordered [lat, lon] pairs describing the closed loop; first and last should equal `start`. */
  coordinates: [number, number][]
}

export function RouteMap({ start, coordinates }: RouteMapProps) {
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
    </MapContainer>
  )
}
