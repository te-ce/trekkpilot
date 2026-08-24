import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'

export type RoutePolyline = {
  /** Stable key, e.g. `candidate-0`. */
  id: string
  coordinates: [number, number][]
  /** Literal hex from ROUTE_COLORS. */
  color: string
  isActive: boolean
}

export type RouteMapProps = {
  /** Start pin, or null before a start point is chosen. */
  start: [number, number] | null
  routes: RoutePolyline[]
  livePosition?: [number, number]
  /** When true, recenter the map as livePosition changes. */
  follow?: boolean
  /** Called when the user taps the map, for drop-a-pin start selection. */
  onMapClick?: (point: { lat: number; lon: number }) => void
  /** Extra classes for the map container, so callers control height/layout. */
  className?: string
}

/**
 * Where the map opens before anything is known — roughly the centre of
 * Germany, so the first paint isn't the middle of the ocean.
 */
const DEFAULT_CENTER: [number, number] = [51.1657, 10.4515]
const DEFAULT_ZOOM = 14

const ACTIVE_PATH_OPTIONS = { weight: 6, opacity: 1 } as const
const INACTIVE_PATH_OPTIONS = { weight: 3, opacity: 0.45 } as const

/** Padding (px) kept around the fitted routes so polylines aren't flush to the edge. */
const FIT_PADDING: [number, number] = [24, 24]

const START_PIN_SIZE: [number, number] = [28, 40]

/**
 * The start pin, drawn as inline SVG rather than an image.
 *
 * Leaflet's default `L.Icon.Default` asks for `marker-icon.png` at a URL it
 * derives from wherever it thinks `leaflet.css` lives. Under a bundler that CSS
 * is concatenated into a fingerprinted stylesheet and the PNGs are never
 * emitted at all, so the request 404s and the marker renders as a broken image.
 * Owning the artwork removes that asset-path guesswork entirely.
 *
 * Literal hex, not `var(--color-moss)`, for the same reason `ROUTE_COLORS` is:
 * the OSM tiles stay light in either scheme, so the pin must too. The white
 * outline keeps it legible over dark tile detail like forest or water.
 */
const START_PIN_ICON = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="${START_PIN_SIZE[0]}" height="${START_PIN_SIZE[1]}" viewBox="0 0 28 40" aria-hidden="true"><path d="M14 1.5c-6.9 0-12.5 5.6-12.5 12.5 0 8.6 10.2 20.4 11.6 22 .5.5 1.3.5 1.8 0 1.4-1.6 11.6-13.4 11.6-22C26.5 7.1 20.9 1.5 14 1.5Z" fill="#0b6e4f" stroke="#ffffff" stroke-width="2.5"/><circle cx="14" cy="14" r="4.5" fill="#ffffff"/></svg>`,
  iconSize: START_PIN_SIZE,
  // Bottom-centre: the pin's tip, not its middle, marks the coordinate.
  iconAnchor: [START_PIN_SIZE[0] / 2, START_PIN_SIZE[1]],
})

/** Translates Leaflet map clicks into the app's `{ lat, lon }` vocabulary. */
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (point: { lat: number; lon: number }) => void
}) {
  useMapEvents({
    click: (event) => {
      onMapClick({ lat: event.latlng.lat, lon: event.latlng.lng })
    },
  })
  return null
}

/** Recenters the map on the walker's live position while following is on. */
function FollowLivePosition({
  livePosition,
  follow,
}: {
  livePosition: [number, number] | undefined
  follow: boolean
}) {
  const map = useMap()

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- syncing an imperative Leaflet viewport, not deriving state
    if (!follow || !livePosition) {
      return
    }
    map.setView(livePosition)
  }, [map, follow, livePosition])

  return null
}

/**
 * Fits the viewport to every drawn route, so several overlaid loops are all
 * visible at once. Does nothing when there is nothing to fit.
 */
function FitRoutes({ routes }: { routes: RoutePolyline[] }) {
  const map = useMap()
  // Effects compare deps by identity, and a fresh search hands us new geometry
  // under the same ids, so the key fingerprints the geometry itself: how many
  // points each route has and where it starts and ends.
  const geometryKey = routes
    .map(
      (route) =>
        `${route.id}:${route.coordinates.length}:${route.coordinates.at(0)?.join(',')}:${route.coordinates.at(-1)?.join(',')}`,
    )
    .join('|')

  const points = useMemo(
    () => routes.flatMap((entry) => entry.coordinates),
    // eslint-disable-next-line react/exhaustive-deps -- geometryKey fingerprints `routes`, whose array identity changes every render
    [geometryKey],
  )

  useEffect(() => {
    if (points.length === 0) {
      return
    }
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- syncing an imperative Leaflet viewport, not deriving state
    map.fitBounds(points, { padding: FIT_PADDING })
  }, [map, points])

  return null
}

/**
 * A single Leaflet map that can draw every candidate loop at once. The active
 * route paints last, thicker and fully opaque, so it reads above the dimmed
 * alternatives.
 *
 * Leaflet needs a sized parent to render at all: the container defaults to
 * `h-full w-full`, so whichever element wraps it (or the `className` a caller
 * passes) must establish a real height.
 */
export function RouteMap({
  start,
  routes,
  livePosition,
  follow = false,
  onMapClick,
  className = 'h-full w-full',
}: RouteMapProps) {
  // Inactive first, active last, so the highlighted route sits on top.
  const drawOrder = [
    ...routes.filter((route) => !route.isActive),
    ...routes.filter((route) => route.isActive),
  ]

  return (
    <MapContainer
      center={start ?? routes[0]?.coordinates[0] ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      // No zoom buttons: they land under the floating pill bar, and pinch,
      // scroll and the keyboard +/- keys all still zoom.
      zoomControl={false}
      className={className}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      <FollowLivePosition livePosition={livePosition} follow={follow} />
      <FitRoutes routes={routes} />
      {drawOrder.map((route) => (
        <Polyline
          key={route.id}
          positions={route.coordinates}
          pathOptions={{
            color: route.color,
            ...(route.isActive ? ACTIVE_PATH_OPTIONS : INACTIVE_PATH_OPTIONS),
          }}
        />
      ))}
      {start && (
        <Marker
          position={start}
          icon={START_PIN_ICON}
          // `alt` only reaches image icons; `title` names the div-based one.
          title="Start point"
        />
      )}
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
