/**
 * A stand-in for the OpenRouteService API, for the end-to-end suite.
 *
 * The app reaches it because `ORS_BASE_URL` points there (see
 * `src/server/orsConfig.ts`); nothing in the app knows it is being tested.
 * Plain `node:http`, no dependencies, and it only knows the three endpoints
 * the app actually calls. The route *data* lives in `orsFixtures.ts` — this
 * file is only dispatch: which fixture answers which request.
 */

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'

import {
  alternativeRoutesResponse,
  geocodeResponse,
  roundTripResponse,
} from './orsFixtures'

export const ORS_FIXTURE_PORT = 4319

export const ORS_FIXTURE_BASE_URL = `http://127.0.0.1:${String(ORS_FIXTURE_PORT)}`

/** The key the app is expected to send; any non-empty value is accepted. */
export const ORS_FIXTURE_API_KEY = 'fixture-ors-key'

const DIRECTIONS_PATH = /^\/v2\/directions\/([\w-]+)\/geojson$/

type DirectionsBody = {
  coordinates?: [number, number][]
  options?: { round_trip?: { length?: number; points?: number; seed?: number } }
  alternative_routes?: { target_count?: number }
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/geo+json;charset=UTF-8',
    'Content-Length': String(Buffer.byteLength(body)),
  })
  response.end(body)
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function point([lon, lat]: [number, number]): { lat: number; lon: number } {
  return { lat, lon }
}

/**
 * Geocoding takes the API key as a query parameter, unlike directions below,
 * which takes it as a header — the same split the app codes for. Rejecting a
 * keyless request is what keeps that wiring honest.
 */
function handleGeocode(url: URL, response: ServerResponse): void {
  if (!url.searchParams.get('api_key')) {
    sendJson(response, 403, { error: 'missing api_key query parameter' })
    return
  }
  sendJson(response, 200, geocodeResponse(url.searchParams.get('text') ?? ''))
}

/**
 * Answers a directions request. Round trips and point-to-point alternatives
 * hit the same ORS endpoint and are told apart the same way ORS itself would:
 * by which options block the body carries.
 */
function directionsPayload(profile: string, body: DirectionsBody): unknown {
  const roundTrip = body.options?.round_trip
  if (roundTrip) {
    return roundTripResponse(profile, roundTrip.seed)
  }

  const [start, stop] = body.coordinates ?? []
  if (body.alternative_routes && start && stop) {
    return alternativeRoutesResponse(profile, point(start), point(stop))
  }

  return null
}

async function handleDirections(
  profile: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!request.headers.authorization) {
    sendJson(response, 403, { error: 'missing Authorization header' })
    return
  }

  const body = (await readJsonBody(request)) as DirectionsBody
  const payload = directionsPayload(profile, body)
  if (!payload) {
    sendJson(response, 400, {
      error:
        'unrecognised directions request: no round_trip or alternative_routes',
    })
    return
  }

  sendJson(response, 200, payload)
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', ORS_FIXTURE_BASE_URL)

  if (url.pathname === '/geocode/search' && request.method === 'GET') {
    handleGeocode(url, response)
    return
  }

  const directions = DIRECTIONS_PATH.exec(url.pathname)
  if (directions && request.method === 'POST') {
    await handleDirections(
      directions[1] ?? 'cycling-regular',
      request,
      response,
    )
    return
  }

  sendJson(response, 404, {
    error: `no ORS fixture for ${request.method ?? 'GET'} ${url.pathname}`,
  })
}

/**
 * Starts the fixture server. Resolves once it is accepting connections, with
 * a `close` the caller must call so the test run can exit.
 */
export function startOrsFixtureServer(
  port: number = ORS_FIXTURE_PORT,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    void route(request, response)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolve({
        baseUrl: `http://127.0.0.1:${String(port)}`,
        close: () =>
          new Promise<void>((done, fail) => {
            // The app server keeps connections alive; without this the close
            // callback never fires and the test run hangs on teardown.
            server.closeAllConnections()
            server.close((error) => (error ? fail(error) : done()))
          }),
      })
    })
  })
}
