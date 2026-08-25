import { useEffect, useRef, useState } from 'react'

import {
  describeGeolocationError,
  logGeolocationError,
} from '#/lib/geolocationError'

export type GeoPoint = { lat: number; lon: number }

export type LiveGeolocation = {
  position: GeoPoint | null
  error: string | null
}

/**
 * Tracks the user's live position via the foreground Geolocation API
 * (`watchPosition`, not polling) while `active` is true (issue 005). Pauses
 * the watch when the tab/app is backgrounded (`document.visibilitychange`)
 * and resumes it when foregrounded again, so there is no background
 * tracking and no battery drain while hidden. Always clears the watch on
 * unmount or when `active` turns false.
 */
export function useLiveGeolocation(active: boolean): LiveGeolocation {
  const [position, setPosition] = useState<GeoPoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    function startWatching() {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (geoPosition) => {
          setError(null)
          setPosition({
            lat: geoPosition.coords.latitude,
            lon: geoPosition.coords.longitude,
          })
        },
        (geoError) => {
          logGeolocationError('watchPosition', geoError)
          setError(describeGeolocationError(geoError))
        },
      )
    }

    function stopWatching() {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopWatching()
      } else {
        startWatching()
      }
    }

    if (document.visibilityState !== 'hidden') {
      startWatching()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopWatching()
    }
  }, [active])

  return { position, error }
}
