/**
 * `GeolocationPositionError.code` collapses very different failures (denied
 * permission, no fix available, browser gave up waiting) into one generic
 * error callback. Browser-level permission can show as "granted" while the
 * API still fails for any of these reasons, so the code is what actually
 * tells you why.
 */
export function describeGeolocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. Check your browser and device location settings.'
    case error.POSITION_UNAVAILABLE:
      return 'Your device could not determine a GPS location. Check that location services are turned on.'
    case error.TIMEOUT:
      return 'Timed out while trying to read your GPS location.'
    default:
      return 'Could not read the current GPS location.'
  }
}

export function logGeolocationError(
  context: string,
  error: GeolocationPositionError,
) {
  console.error(
    `[geolocation] ${context} failed (code ${error.code}):`,
    error.message,
  )
}
