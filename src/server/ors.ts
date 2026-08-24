import { targetDistanceMeters, type ActivityType } from '#/lib/activity'

export type GeoPoint = { lat: number; lon: number }

const ORS_PROFILE: Record<ActivityType, string> = {
  cycling: 'cycling-regular',
  trekking: 'foot-walking',
}

export type RoundTripRequestInput = {
  activity: ActivityType
  start: GeoPoint
  distanceMeters: number
}

export type OrsRequest = {
  url: string
  body: {
    coordinates: [number, number][]
    options: {
      round_trip: {
        length: number
        points: number
      }
    }
  }
}

export function buildRoundTripRequest({
  activity,
  start,
  distanceMeters,
}: RoundTripRequestInput): OrsRequest {
  const profile = ORS_PROFILE[activity]

  return {
    url: `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
    body: {
      coordinates: [[start.lon, start.lat]],
      options: {
        round_trip: {
          length: distanceMeters,
          points: 3,
        },
      },
    },
  }
}

export type LoopRouteInput = {
  activity: ActivityType
  start: GeoPoint
  durationMinutes: number
}

export type LoopRouteResult = {
  /** [lat, lon] pairs describing the closed loop, in order. */
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

export async function fetchLoopRoute({
  activity,
  start,
  durationMinutes,
}: LoopRouteInput): Promise<LoopRouteResult> {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    throw new Error('ORS_API_KEY is not configured on the server')
  }

  const distanceMeters = targetDistanceMeters(activity, durationMinutes)
  const { url, body } = buildRoundTripRequest({
    activity,
    start,
    distanceMeters,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `ORS request failed with status ${response.status}: ${detail}`,
    )
  }

  const geojson = await response.json()
  const feature = geojson.features[0]
  const coordinates: [number, number][] = feature.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => [lat, lon],
  )

  return {
    coordinates,
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
  }
}
