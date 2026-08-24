const MAX_POINTS = 9

function formatPoint([lat, lon]: [number, number]): string {
  return `${lat},${lon}`
}

/**
 * Down-samples `coordinates` to at most `MAX_POINTS` evenly-spaced points,
 * always keeping the first and last. Google Maps has no arbitrary-polyline
 * import, so a long route's coordinate list must be reduced to a handful of
 * waypoints it can route through directly.
 */
function downsample(coordinates: [number, number][]): [number, number][] {
  if (coordinates.length <= MAX_POINTS) {
    return coordinates
  }

  const lastIndex = coordinates.length - 1
  const indices = Array.from({ length: MAX_POINTS }, (_, i) =>
    Math.round((i * lastIndex) / (MAX_POINTS - 1)),
  )

  return indices.map((index) => {
    const point = coordinates[index]
    if (!point) {
      throw new Error(`downsample: index ${index} out of bounds`)
    }
    return point
  })
}

export function buildGoogleMapsUrl(coordinates: [number, number][]): string {
  const sampled = downsample(coordinates)
  const origin = sampled[0]
  const destination = sampled[sampled.length - 1]
  if (!origin || !destination) {
    throw new Error('buildGoogleMapsUrl requires at least one coordinate')
  }

  const waypoints = sampled.slice(1, -1)
  const waypointsParam =
    waypoints.length > 0
      ? `&waypoints=${waypoints.map(formatPoint).join('|')}`
      : ''

  return `https://www.google.com/maps/dir/?api=1&origin=${formatPoint(origin)}&destination=${formatPoint(destination)}${waypointsParam}`
}
