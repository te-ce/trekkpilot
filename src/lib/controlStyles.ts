/**
 * Shared Tailwind class strings for the handful of control shapes the shell
 * repeats: pills over the map, buttons and fields in the sheet, and the
 * uppercase mono micro-labels. Kept in one place so every tap target keeps its
 * 44px minimum and its focus ring, rather than each component re-deriving them.
 */

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss'

export const PRIMARY_BUTTON_CLASS = `flex min-h-12 w-full items-center justify-center rounded-2xl bg-moss px-4 text-base font-semibold text-surface hover:brightness-110 disabled:opacity-60 ${FOCUS_RING}`

export const SECONDARY_BUTTON_CLASS = `min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-ink hover:bg-surface ${FOCUS_RING}`

/**
 * Square sibling of `SECONDARY_BUTTON_CLASS`, for the icon-only controls that
 * sit at the end of a one-line row (locate, search). Same 44px tap target as
 * the labelled version — an icon is smaller, the target is not.
 */
export const SECONDARY_ICON_BUTTON_CLASS = `flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-base text-ink hover:bg-surface aria-expanded:border-moss aria-expanded:text-moss ${FOCUS_RING}`

export const QUIET_BUTTON_CLASS = `min-h-11 rounded-xl px-1 text-sm font-medium text-ink-2 hover:text-ink ${FOCUS_RING}`

export const FIELD_CLASS =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss'

export const SELECT_CLASS =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-moss'

export const MICRO_LABEL_CLASS =
  'font-mono text-[0.6875rem] font-medium tracking-[0.08em] text-ink-3 uppercase'

export const PILL_CLASS = `flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-[0_2px_10px_rgba(22,33,28,0.12)] hover:bg-surface-2 ${FOCUS_RING}`

export const ICON_BUTTON_CLASS = `flex size-11 items-center justify-center rounded-full border border-line bg-surface text-base text-ink shadow-[0_2px_10px_rgba(22,33,28,0.12)] hover:bg-surface-2 ${FOCUS_RING}`

/** The metrics line under a route's headline numbers. */
export const METRICS_LINE_CLASS = 'font-mono text-xs tabular-nums text-ink-3'
