import { useState } from 'react'

import {
  FIELD_CLASS,
  MICRO_LABEL_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_ICON_BUTTON_CLASS,
} from '#/lib/controlStyles'
import {
  describeGeolocationError,
  logGeolocationError,
} from '#/lib/geolocationError'
import { formatCoordinates } from '#/lib/labels'
import { geocodeLocation } from '#/server/functions/geocodeLocation'

export type GeoPoint = { lat: number; lon: number }

export type LocationPickerProps = {
  /** Names the group for assistive tech: "Start point", "Stop point". */
  legend: string
  /**
   * The same thing in the two or three characters the row can spare —
   * "From", "To". Visible chrome only; the legend above is what gets read.
   */
  shortLabel: string
  /** Prefixes element ids so start/stop pickers don't collide when both render. */
  idPrefix: string
  value: GeoPoint | null
  /** Place name for `value` when it came from a search, shown instead of coordinates. */
  valueLabel?: string | null
  onChange: (point: GeoPoint, label?: string) => void
  onError: (message: string) => void
  /** GPS lookup only makes sense for the user's own current position (the start point). */
  showCurrentLocation?: boolean
  /** One line telling the user the fastest way to set this point, while it has none. */
  hint: string
}

/**
 * One location input, reused for the start and the stop point (issue 004).
 *
 * All the ways in from issue 001/004 are still here, but the row itself is one
 * line: what the point currently is, and the two controls that change it. The
 * quick paths — tapping the map, which the map itself handles, and GPS — need
 * no more than that, and a named-place search or a raw lat/lon is one tap away
 * behind the search button rather than three permanent rows in the sheet.
 */
export function LocationPicker({
  legend,
  shortLabel,
  idPrefix,
  value,
  valueLabel,
  onChange,
  onError,
  showCurrentLocation = false,
  hint,
}: LocationPickerProps) {
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  /**
   * A point the map can pin and GPS can fill has quicker paths than typing, so
   * its search starts folded. Where neither applies — the stop point, which the
   * map does not set — searching *is* the way in, and folding it away would
   * hide the only door.
   */
  const [isSearchOpen, setIsSearchOpen] = useState(!showCurrentLocation)

  function useCurrentLocation() {
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        onChange({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      (error) => {
        setIsLocating(false)
        logGeolocationError('getCurrentPosition', error)
        onError(describeGeolocationError(error))
      },
      // A one-shot fix for a button tap: worth waiting a bit longer and
      // asking for the best accuracy available, but it must still give up
      // rather than hang forever (browser default timeout is Infinity).
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
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
      onChange({ lat: result.lat, lon: result.lon }, result.label)
    } catch {
      onError(`Could not find a location for "${searchQuery}".`)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>

      <div className="flex items-center gap-2">
        {/* The legend says this already; here it is only for the eye. */}
        <span aria-hidden="true" className={MICRO_LABEL_CLASS}>
          {shortLabel}
        </span>

        {value ? (
          <p className="text-ink flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
            <span aria-hidden="true" className="text-moss">
              ●
            </span>
            <span
              className={`truncate ${valueLabel ? '' : 'font-mono tabular-nums'}`}
            >
              {valueLabel ?? formatCoordinates(value)}
            </span>
          </p>
        ) : (
          <p className="text-ink-2 min-w-0 flex-1 truncate text-sm">{hint}</p>
        )}

        {showCurrentLocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={isLocating}
            aria-label="Use my current location"
            aria-busy={isLocating}
            className={SECONDARY_ICON_BUTTON_CLASS}
          >
            <span aria-hidden="true">{isLocating ? '…' : '📍'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsSearchOpen((open) => !open)}
          // Named for both of the ways in it reveals, and named apart from the
          // search field it uncovers so the two never answer the same query.
          aria-label="Search or enter coordinates"
          aria-expanded={isSearchOpen}
          className={SECONDARY_ICON_BUTTON_CLASS}
        >
          <span aria-hidden="true">🔍</span>
        </button>
      </div>

      {isSearchOpen && (
        <div className="mt-2">
          <div className="flex gap-2">
            <label htmlFor={`${idPrefix}-search`} className="sr-only">
              Search for a place
            </label>
            <input
              id={`${idPrefix}-search`}
              type="search"
              placeholder="Search for a place"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={FIELD_CLASS}
            />
            <button
              type="button"
              onClick={() => void searchLocation()}
              disabled={isSearching}
              className={SECONDARY_BUTTON_CLASS}
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>

          <details className="mt-2">
            <summary className="text-ink-3 cursor-pointer py-1 text-sm">
              Enter coordinates
            </summary>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-24 flex-1">
                <label
                  htmlFor={`${idPrefix}-lat`}
                  className={MICRO_LABEL_CLASS}
                >
                  Latitude
                </label>
                <input
                  id={`${idPrefix}-lat`}
                  type="number"
                  value={manualLat}
                  onChange={(event) => setManualLat(event.target.value)}
                  className={`${FIELD_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div className="min-w-24 flex-1">
                <label
                  htmlFor={`${idPrefix}-lon`}
                  className={MICRO_LABEL_CLASS}
                >
                  Longitude
                </label>
                <input
                  id={`${idPrefix}-lon`}
                  type="number"
                  value={manualLon}
                  onChange={(event) => setManualLon(event.target.value)}
                  className={`${FIELD_CLASS} font-mono tabular-nums`}
                />
              </div>
              <button
                type="button"
                onClick={setPinManually}
                className={SECONDARY_BUTTON_CLASS}
              >
                Use these coordinates
              </button>
            </div>
          </details>
        </div>
      )}
    </fieldset>
  )
}
