import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import { MapLayerControl } from '#/components/MapLayerControl'
import { BASE_LAYERS, BICYCLE_LAYER, type MapLayerId } from '#/lib/mapLayers'

export type RoutePolyline = {
  /** Stable key, e.g. `candidate-0`. */
  id: string
  coordinates: [number, number][]
  /** Literal hex from ROUTE_COLORS. */
  color: string
  isActive: boolean
}

/**
 * A one-shot "put the viewport here" request. The `token` is what makes it
 * one-shot: the same coordinates asked for twice are two distinct requests
 * (tap "centre on me", pan away, tap it again), so the position alone cannot
 * tell them apart.
 */
export type MapJumpRequest = {
  position: [number, number]
  token: number
}

export type RouteMapProps = {
  /** Start pin, or null before a start point is chosen. */
  start: [number, number] | null
  routes: RoutePolyline[]
  livePosition?: [number, number]
  /** When true, recenter the map as livePosition changes. */
  follow?: boolean
  /** Centres the map once per distinct `token`, at a street-level zoom. */
  jumpTo?: MapJumpRequest
  /**
   * Called when the user drags the map themselves, so the caller can drop out
   * of follow mode. Only listened for while `follow` is on.
   */
  onFollowCancel?: () => void
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

/**
 * Zoom used when jumping to the user's own position: two steps in from the
 * default, close enough to make out the street you are standing on without
 * losing the surrounding block.
 */
const LOCATE_ZOOM = 16

const ACTIVE_PATH_OPTIONS = { weight: 6, opacity: 1 } as const
const INACTIVE_PATH_OPTIONS = { weight: 4, opacity: 0.75 } as const

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
 * Drops out of follow mode the moment the user drags the map.
 *
 * A follow mode that fights the user's own panning is worse than no follow
 * mode at all: every pan would be yanked back on the next GPS fix. Leaflet's
 * `dragstart` only fires for real user gestures — `map.setView` from
 * `FollowLivePosition` does not raise it — so this cannot cancel itself.
 */
function CancelFollowOnDrag({
  onFollowCancel,
}: {
  onFollowCancel: () => void
}) {
  useMapEvents({
    dragstart: () => {
      onFollowCancel()
    },
  })
  return null
}

/**
 * Honours one-shot centring requests: one `map.setView` per distinct token,
 * regardless of whether the coordinates changed.
 */
function JumpToPosition({ jumpTo }: { jumpTo: MapJumpRequest | undefined }) {
  const map = useMap()
  const token = jumpTo?.token
  const position = jumpTo?.position

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- syncing an imperative Leaflet viewport, not deriving state
    if (!position) {
      return
    }
    map.setView(position, LOCATE_ZOOM)
    // eslint-disable-next-line react/exhaustive-deps -- keyed on the token, not the coordinates: the same point asked for twice is two jumps
  }, [map, token])

  return null
}

/**
 * Fits the viewport to every drawn route, so several overlaid loops are all
 * visible at once. Does nothing when there is nothing to fit.
 */
function FitRoutes({
  routes,
  follow,
}: {
  routes: RoutePolyline[]
  follow: boolean
}) {
  const map = useMap()
  // Follow wins over fit-bounds: someone who is out walking with the map
  // locked to their position keeps that lock even if a fresh search lands.
  // Read through a ref, deliberately outside the effect's deps, so *toggling*
  // follow never triggers a fit — otherwise cancelling follow by panning would
  // immediately snap the viewport back onto the route the user just panned off.
  const followRef = useRef(follow)
  followRef.current = follow
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
    if (points.length === 0 || followRef.current) {
      return
    }
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- syncing an imperative Leaflet viewport, not deriving state
    map.fitBounds(points, { padding: FIT_PADDING })
  }, [map, points])

  return null
}

/**
 * Keeps Leaflet's cached container size in sync with the DOM.
 *
 * Leaflet measures its container once and caches that size; it has no way to
 * know the mobile split-screen layout just resized it (minimizing/expanding
 * the plan sheet changes the map's grid row, not the window), so without this
 * the map would keep rendering at its stale size until the next manual pan.
 */
function InvalidateSizeOnResize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  return null
}

/** Where the first paint sits: the start pin, else the first route, else home. */
function initialCenter(
  start: [number, number] | null,
  routes: RoutePolyline[],
): [number, number] {
  return start ?? routes[0]?.coordinates[0] ?? DEFAULT_CENTER
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
  jumpTo,
  onFollowCancel,
  onMapClick,
  className = 'h-full w-full',
}: RouteMapProps) {
  // Inactive first, active last, so the highlighted route sits on top.
  const drawOrder = [
    ...routes.filter((route) => !route.isActive),
    ...routes.filter((route) => route.isActive),
  ]
  const [layer, setLayer] = useState<MapLayerId>('streets')
  const [bikeLanes, setBikeLanes] = useState(false)
  const base = BASE_LAYERS[layer]

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={initialCenter(start, routes)}
        zoom={DEFAULT_ZOOM}
        // No zoom buttons: they land under the floating pill bar, and pinch,
        // scroll and the keyboard +/- keys all still zoom.
        zoomControl={false}
        className={className}
      >
        <TileLayer url={base.url} attribution={base.attribution} />
        {bikeLanes && (
          <TileLayer
            url={BICYCLE_LAYER.url}
            attribution={BICYCLE_LAYER.attribution}
          />
        )}
        <InvalidateSizeOnResize />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        <FollowLivePosition livePosition={livePosition} follow={follow} />
        {follow && onFollowCancel && (
          <CancelFollowOnDrag onFollowCancel={onFollowCancel} />
        )}
        <JumpToPosition jumpTo={jumpTo} />
        <FitRoutes routes={routes} follow={follow} />
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
      <MapLayerControl
        layer={layer}
        onLayerChange={setLayer}
        bikeLanes={bikeLanes}
        onToggleBikeLanes={() => setBikeLanes((current) => !current)}
      />
    </div>
  )
}
