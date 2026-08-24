import { useState } from 'react'

import { geocodeLocation } from '#/server/functions/geocodeLocation'

export type GeoPoint = { lat: number; lon: number }

export type LocationPickerProps = {
  legend: string
  /** Prefixes element ids so start/stop pickers don't collide when both render. */
  idPrefix: string
  value: GeoPoint | null
  onChange: (point: GeoPoint) => void
  onError: (message: string) => void
  /** GPS lookup only makes sense for the user's own current position (the start point). */
  showCurrentLocation?: boolean
}

/**
 * A single location input, reused for both the start and stop point (issue
 * 004): current-GPS (start only), a named-location search resolved via ORS
 * geocoding, or a manual lat/lon override.
 */
export function LocationPicker({
  legend,
  idPrefix,
  value,
  onChange,
  onError,
  showCurrentLocation = false,
}: LocationPickerProps) {
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  function useCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () => {
        onError('Could not read the current GPS location.')
      },
    )
  }

  function setPinManually() {
    const lat = Number(manualLat)
    const lon = Number(manualLon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      onError('Latitude and longitude must be numbers.')
      return
    }
    onChange({ lat, lon })
  }

  async function searchLocation() {
    if (!searchQuery.trim()) {
      return
    }
    setIsSearching(true)
    try {
      const result = await geocodeLocation({ data: { query: searchQuery } })
      onChange({ lat: result.lat, lon: result.lon })
    } catch {
      onError(`Could not find a location for "${searchQuery}".`)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <fieldset>
      <legend>{legend}</legend>

      {showCurrentLocation && (
        <button type="button" onClick={useCurrentLocation}>
          Use current location
        </button>
      )}

      <label htmlFor={`${idPrefix}-search`}>Search location</label>
      <input
        id={`${idPrefix}-search`}
        type="text"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />
      <button
        type="button"
        onClick={() => void searchLocation()}
        disabled={isSearching}
      >
        {isSearching ? 'Searching…' : 'Search'}
      </button>

      <label htmlFor={`${idPrefix}-lat`}>Latitude</label>
      <input
        id={`${idPrefix}-lat`}
        type="number"
        value={manualLat}
        onChange={(event) => setManualLat(event.target.value)}
      />

      <label htmlFor={`${idPrefix}-lon`}>Longitude</label>
      <input
        id={`${idPrefix}-lon`}
        type="number"
        value={manualLon}
        onChange={(event) => setManualLon(event.target.value)}
      />

      <button type="button" onClick={setPinManually}>
        Set pin manually
      </button>

      {value && (
        <p>
          {legend}: {value.lat}, {value.lon}
        </p>
      )}
    </fieldset>
  )
}
