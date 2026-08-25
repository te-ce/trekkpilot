/**
 * Base tile sets and overlays `RouteMap` can switch between. Kept separate
 * from `MapLayerControl` (the component that offers the switch) so that file
 * exports only the component, as fast refresh requires.
 */

/** Which base tiles are painted under the routes. */
export type MapLayerId = 'streets' | 'satellite'

/** A base tile set: its source and the attribution it's licensed under. */
export type TileLayerConfig = {
  url: string
  attribution: string
}

export const BASE_LAYERS: Record<MapLayerId, TileLayerConfig> = {
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    // Esri's World Imagery is a free, key-less tile source — the closest
    // equivalent to a "satellite view" without standing up billed tile infra.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Imagery &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS user community',
  },
}

/**
 * Cycling-route overlay, drawn on top of whichever base layer is active.
 * Waymarked Trails renders official/signed cycling routes as coloured lines —
 * the closest free, key-less equivalent to Google's bicycling layer.
 */
export const BICYCLE_LAYER: TileLayerConfig = {
  url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
  attribution:
    'Cycling routes &copy; <a href="https://waymarkedtrails.org">waymarkedtrails.org</a>',
}
