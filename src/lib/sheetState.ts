/**
 * What the bottom sheet is currently showing.
 *
 * The sheet is the app's only surface besides the map, so "which screen am I
 * on" is entirely a question about the sheet. It is not stored directly:
 * `resolveSheetState` derives it from what the user last asked for (the
 * intent) plus what actually exists, so the sheet can never sit on a view with
 * nothing in it.
 */
export type SheetState = 'plan' | 'loading' | 'results' | 'active' | 'history'

/** The view the user last asked for. 'loading' is never asked for — it happens. */
export type SheetIntent = Exclude<SheetState, 'loading'>

export type SheetInput = {
  intent: SheetIntent
  isLoading: boolean
  hasCandidates: boolean
  hasActiveRoute: boolean
}

export function resolveSheetState({
  intent,
  isLoading,
  hasCandidates,
  hasActiveRoute,
}: SheetInput): SheetState {
  if (isLoading) {
    return 'loading'
  }
  if (intent === 'history') {
    return 'history'
  }
  if (intent === 'active' && hasActiveRoute) {
    return 'active'
  }
  if (intent === 'results' && hasCandidates) {
    return 'results'
  }
  return 'plan'
}
