import type { ReactNode } from 'react'

/**
 * The app's one surface besides the map. On a phone it is a real second row
 * below the map — minimizing it hands that row's height back to the map
 * rather than merely sliding a floating card out of the way — with a
 * drag-handle affordance and a minimize toggle. From `md` up the very same
 * markup becomes a floating card anchored to the bottom-left of the map,
 * where screen space is no longer the constraint, so it stays permanently
 * expanded there.
 */
export function BottomSheet({
  label,
  minimized,
  onToggleMinimized,
  children,
}: {
  /** Names the sheet's current contents for assistive tech. */
  label: string
  /** Mobile-only: when true, the sheet collapses to a slim handle bar. */
  minimized: boolean
  onToggleMinimized: () => void
  children: ReactNode
}) {
  return (
    <div className="z-30 md:pointer-events-none md:absolute md:inset-0 md:flex md:flex-col md:items-start md:justify-end md:p-4">
      <section
        aria-label={label}
        className={`border-line bg-surface pointer-events-auto w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t shadow-[0_-8px_30px_rgba(22,33,28,0.18)] transition-[max-height] duration-200 md:max-h-[72dvh] md:w-auto md:max-w-sm md:rounded-3xl md:border md:shadow-[0_8px_30px_rgba(22,33,28,0.18)] ${
          minimized ? 'max-h-14' : 'max-h-[60dvh]'
        }`}
      >
        <div className="bg-surface relative sticky top-0 flex justify-center pt-2 pb-1 md:hidden">
          <span
            aria-hidden="true"
            className="bg-line h-1.5 w-10 rounded-full"
          />
          <button
            type="button"
            onClick={onToggleMinimized}
            aria-expanded={!minimized}
            aria-label={minimized ? 'Expand plan panel' : 'Minimize plan panel'}
            className="text-ink-3 active:bg-line/40 absolute top-1 right-2 flex h-8 w-8 items-center justify-center rounded-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={minimized ? '' : 'rotate-180'}
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>
        <div
          className={`px-4 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${
            minimized ? 'hidden md:block' : ''
          }`}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
