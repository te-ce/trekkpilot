import { ICON_BUTTON_CLASS } from '#/lib/controlStyles'
import type { MapLayerId } from '#/lib/mapLayers'

const BASE_LAYER_OPTIONS: { id: MapLayerId; label: string }[] = [
  { id: 'streets', label: 'Streets' },
  { id: 'satellite', label: 'Satellite' },
]

/**
 * Base-layer switcher plus the bike-lanes toggle, floated over the map. Kept
 * unobtrusive — small, bottom-right, out of the way of the top pill bar and
 * the bottom sheet — since it's a secondary control most sessions never touch.
 */
export function MapLayerControl({
  layer,
  onLayerChange,
  bikeLanes,
  onToggleBikeLanes,
}: {
  layer: MapLayerId
  onLayerChange: (layer: MapLayerId) => void
  bikeLanes: boolean
  onToggleBikeLanes: () => void
}) {
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-[1000] flex flex-col items-end gap-2">
      <div className="border-line bg-surface pointer-events-auto flex overflow-hidden rounded-full border shadow-[0_2px_10px_rgba(22,33,28,0.12)]">
        {BASE_LAYER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={layer === option.id}
            onClick={() => onLayerChange(option.id)}
            className="text-ink aria-pressed:bg-moss aria-pressed:text-surface hover:bg-surface-2 aria-pressed:hover:bg-moss focus-visible:outline-moss min-h-11 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Show cycling routes"
        aria-pressed={bikeLanes}
        title="Show cycling routes"
        onClick={onToggleBikeLanes}
        className={`pointer-events-auto ${ICON_BUTTON_CLASS} aria-pressed:border-moss aria-pressed:bg-moss aria-pressed:text-surface`}
      >
        <span aria-hidden="true">🚲</span>
      </button>
    </div>
  )
}
