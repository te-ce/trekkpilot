import { useEffect, useRef, useState } from 'react'

export type GeoPoint = { lat: number; lon: number }

/**
 * Tracks the user's live position via the foreground Geolocation API
 * (`watchPosition`, not polling) while `active` is true (issue 005). Pauses
 * the watch when the tab/app is backgrounded (`document.visibilitychange`)
 * and resumes it when foregrounded again, so there is no background
 * tracking and no battery drain while hidden. Always clears the watch on
 * unmount or when `active` turns false.
 */
export function useLiveGeolocation(active: boolean): GeoPoint | null {
  const [position, setPosition] = useState<GeoPoint | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    function startWatching() {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (geoPosition) => {
          setPosition({
            lat: geoPosition.coords.latitude,
            lon: geoPosition.coords.longitude,
          })
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

  return position
}
