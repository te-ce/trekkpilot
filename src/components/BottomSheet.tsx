import type { ReactNode } from 'react'

/**
 * The app's one surface besides the map. On a phone it is a bottom sheet with
 * a drag-handle affordance; from `md` up the very same markup becomes a
 * floating card anchored to the bottom-left of the map. One code path, two
 * shapes — there is no second layout.
 */
export function BottomSheet({
  label,
  children,
}: {
  /** Names the sheet's current contents for assistive tech. */
  label: string
  children: ReactNode
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end md:items-start md:p-4">
      <section
        aria-label={label}
        className="border-line bg-surface pointer-events-auto max-h-[60dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t shadow-[0_-8px_30px_rgba(22,33,28,0.18)] transition-[max-height] duration-200 md:max-h-[72dvh] md:w-auto md:max-w-sm md:rounded-3xl md:border md:shadow-[0_8px_30px_rgba(22,33,28,0.18)]"
      >
        <div className="bg-surface sticky top-0 flex justify-center pt-2 pb-1 md:hidden">
          <span
            aria-hidden="true"
            className="bg-line h-1.5 w-10 rounded-full"
          />
        </div>
        <div className="px-4 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </div>
  )
}
