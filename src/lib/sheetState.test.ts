import { describe, expect, it } from 'vitest'

import { resolveSheetState, type SheetInput } from './sheetState'

function input(overrides: Partial<SheetInput> = {}): SheetInput {
  return {
    intent: 'plan',
    isLoading: false,
    hasCandidates: false,
    hasActiveRoute: false,
    ...overrides,
  }
}

describe('resolveSheetState', () => {
  it('opens on the plan, since nothing has been asked for yet', () => {
    expect(resolveSheetState(input())).toBe('plan')
  })

  it('shows progress while the search is running, whatever was asked for', () => {
    expect(
      resolveSheetState(
        input({ intent: 'results', isLoading: true, hasCandidates: true }),
      ),
    ).toBe('loading')
  })

  it('shows the results list once candidates exist', () => {
    expect(
      resolveSheetState(input({ intent: 'results', hasCandidates: true })),
    ).toBe('results')
  })

  it('shows the picked route when one is active', () => {
    expect(
      resolveSheetState(
        input({ intent: 'active', hasCandidates: true, hasActiveRoute: true }),
      ),
    ).toBe('active')
  })

  it('shows history on request even with a route already picked', () => {
    expect(
      resolveSheetState(
        input({ intent: 'history', hasCandidates: true, hasActiveRoute: true }),
      ),
    ).toBe('history')
  })

  it('falls back to the plan when the asked-for view has nothing to show', () => {
    expect(resolveSheetState(input({ intent: 'results' }))).toBe('plan')
    expect(
      resolveSheetState(input({ intent: 'active', hasCandidates: true })),
    ).toBe('plan')
  })

  it('reopens the plan editor even when candidates are already on the map', () => {
    expect(
      resolveSheetState(
        input({ intent: 'plan', hasCandidates: true, hasActiveRoute: true }),
      ),
    ).toBe('plan')
  })
})
